import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import mongoose from "mongoose";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma.js";
import { connectTestMongo, createIdentity, deleteIdentities } from "./helpers/identity.js";
import { hashPassword } from "../src/utils/bcrypt.js";

// Real HTTP, Mongo identities, PostgreSQL effects. Refuse business databases.
async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "", /^scms_verify_/);
  assert.match(new URL(process.env.MONGO_URI!).pathname, /^\/scms_verify_/);
  await connectTestMongo();
  const run = randomUUID();
  const users: string[] = [];
  const facilities: string[] = [];
  const plans: string[] = [];
  const sports: string[] = [];
  let seededLegacyFacility = false;
  let server: Server | undefined;
  let sockets: import("socket.io").Server | undefined;
  let passed = 0;
  const failures: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); passed++; console.log("PASS " + name); }
    catch (e) { failures.push(name + ": " + (e as Error).message); console.log("FAIL " + failures.at(-1)); }
  };
  try {
    // Isolated databases created with `db push` lack migration seed data.
    // Match 20261005000000_facilities_roles before exercising registration.
    if (!(await prisma.facility.findUnique({ where: { id: "legacy-main" } }))) {
      await prisma.facility.create({ data: { id: "legacy-main", code: "LEGACY_MAIN", name: "Cơ sở hiện tại", address: "Cần cập nhật địa chỉ" } });
      seededLegacyFacility = true;
    }
    const app = (await import("../src/app.js")).default;
    server = createServer(app);
    const { Server: SocketServer } = await import("socket.io");
    const { setupSocket } = await import("../src/modules/chat/chat.socket.js");
    sockets = new SocketServer(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
    setupSocket(sockets);
    server.listen(process.argv.includes("--browser") ? Number(process.env.PORT || 8091) : 0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
    const tokens: Record<string, { accessToken: string; refreshToken: string }> = {};
    const identities: Record<string, any> = {};
    let facility = "";
    const request = async (role: string, method: string, path: string, body?: unknown, scoped = true) => {
      const res = await fetch(base + path, {
        method,
        headers: { "Content-Type": "application/json", ...(tokens[role] ? { Authorization: `Bearer ${tokens[role].accessToken}` } : {}), ...(scoped && facility ? { "X-Facility-Id": facility } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: await res.json() as any };
    };
    const ok = async (role: string, method: string, path: string, body?: unknown) => {
      const r = await request(role, method, path, body);
      assert.ok(r.status >= 200 && r.status < 300, `${method} ${path}: ${r.status} ${r.body.message}`);
      return r.body;
    };
    const password = "Audit-Integration!2026";
    await check("register: Mongo identity + PostgreSQL profile + FREE entitlement; duplicate rejected", async () => {
      const email = `${run}-registered@test.invalid`;
      const result = await ok("", "POST", "/auth/register", { email, fullName: "Audit Registered", password });
      users.push(result.data.id);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: result.data.id }, include: { memberProfile: true } });
      assert.equal(user.role, "MEMBER");
      assert.equal(user.memberProfile!.id, result.data.memberProfile.id);
      assert.ok(await prisma.membershipSubscription.findFirst({ where: { memberId: user.memberProfile!.id, tier: "FREE", status: "ACTIVE" } }));
      assert.equal((await request("", "POST", "/auth/register", { email, fullName: "Duplicate", password })).status, 409);
    });
    for (const role of ["ADMIN", "MANAGER", "RECEPTIONIST", "COACH", "MEMBER"]) {
      const user = await createIdentity({ email: `${run}-${role}@test.invalid`, fullName: `Audit ${role}`, password: await hashPassword(password), role: role as any });
      identities[role] = user;
      users.push(user.id);
      await check(`${role}: login -> /auth/me -> refresh`, async () => {
        const login = await ok("", "POST", "/auth/login", { email: user.email, password });
        tokens[role] = login.data;
        const me = await ok(role, "GET", "/auth/me");
        assert.equal(me.data.role, role);
        assert.equal(me.data.id, user.id);
        assert.ok(!("password" in me.data));
        const refresh = await ok("", "POST", "/auth/refresh-token", { refreshToken: tokens[role].refreshToken });
        assert.ok(refresh.data.accessToken);
        tokens[role].accessToken = refresh.data.accessToken;
      });
    }
    facility = (await ok("ADMIN", "POST", "/facilities", { name: `Audit ${run}`, code: `A-${run}`, address: "Test facility" })).data.id;
    facilities.push(facility);
    for (const role of ["MANAGER", "RECEPTIONIST", "COACH"]) await ok("ADMIN", "POST", `/facilities/${facility}/staff`, { userId: identities[role].id, role });
    for (const role of Object.keys(identities)) await check(`${role}: assigned facility and profile`, async () => {
      const list = await ok(role, "GET", "/facilities");
      assert.ok(list.data.some((f: any) => f.id === facility));
    });
    await check("auth/validation: anonymous, bad login, invalid enum, role denial", async () => {
      assert.equal((await request("", "GET", "/rooms")).status, 401);
      assert.equal((await request("", "POST", "/auth/login", { email: identities.MEMBER.email, password: "wrong" })).status, 401);
      assert.equal((await request("MEMBER", "POST", "/rooms", { name: "Forbidden", capacity: 5, areaType: "INDOOR" })).status, 403);
      assert.equal((await request("MANAGER", "POST", "/rooms", { name: "Invalid", capacity: 5, areaType: "INVALID" })).status, 400);
      assert.equal((await request("MANAGER", "GET", "/rooms", undefined, false)).status, 400);
    });
    let planId = "", sportId = "", roomId = "", classId = "", scheduleId = "", enrollmentId = "";
    await check("ADMIN: create/read/update global catalog; MANAGER price write denied", async () => {
      planId = (await ok("ADMIN", "POST", "/membership-plans", { name: `Audit plan ${run}`, price: 100000, durationDays: 30, tier: "MEMBERSHIP", maxConcurrentClasses: 3 })).data.id;
      plans.push(planId);
      assert.equal((await ok("ADMIN", "PATCH", `/membership-plans/${planId}`, { description: "Audited" })).data.description, "Audited");
      assert.equal((await request("MANAGER", "PATCH", `/membership-plans/${planId}`, { price: 1 })).status, 403);
      sportId = (await ok("ADMIN", "POST", "/sports", { name: `Audit sport ${run}`, areaTypes: ["INDOOR"] })).data.id;
      sports.push(sportId);
      await ok("ADMIN", "PUT", `/coaches/${identities.COACH.coachProfile.id}/specializations`, { sportIds: [sportId] });
    });
    await check("MANAGER: coach profile update persisted to Mongo and projection", async () => {
      const id = identities.COACH.id;
      await ok("MANAGER", "PATCH", `/coaches/${id}`, { specialization: "Audit training", experienceYears: 4 });
      assert.equal((await ok("MANAGER", "GET", `/coaches/${id}`)).data.coachProfile.experienceYears, 4);
      assert.equal((await prisma.coachProfile.findUniqueOrThrow({ where: { userId: id } })).experienceYears, 4);
    });
    await check("profile updates persist across Mongo /auth/me and relational member data", async () => {
      await ok("MEMBER", "PATCH", "/auth/me", { fullName: "Audit Updated Member", fitnessGoal: "Improve endurance" });
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: identities.MEMBER.id } })).fullName, "Audit Updated Member");
      assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: identities.MEMBER.id } })).fitnessGoal, "Improve endurance");
      await ok("RECEPTIONIST", "PATCH", `/members/${identities.MEMBER.memberProfile.id}`, { trainingLevel: "INTERMEDIATE" });
      assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: identities.MEMBER.id } })).trainingLevel, "INTERMEDIATE");
    });
    await check("RECEPTIONIST: subscription -> payment -> invoice persisted", async () => {
      const result = await ok("RECEPTIONIST", "POST", "/subscriptions", { memberId: identities.MEMBER.memberProfile.id, planId, paymentMethod: "CASH" });
      const subscription = await prisma.membershipSubscription.findFirstOrThrow({ where: { memberId: identities.MEMBER.memberProfile.id, planId, facilityId: facility, status: "ACTIVE" } });
      const payment = await prisma.payment.findFirstOrThrow({ where: { subscriptionId: subscription.id } });
      assert.equal(payment.status, "SUCCESS");
      assert.equal(Number(payment.amount), 100000);
      assert.ok(await prisma.invoice.findFirst({ where: { paymentId: payment.id } }));
      assert.ok(result.data);
      assert.equal((await ok("MEMBER", "GET", `/payments/${payment.id}`)).data.status, "SUCCESS");
    });
    await check("SePay status permission: ADMIN inherited access, owning MEMBER allowed, COACH denied", async () => {
      // A pending order fixture tests authorization only; no simulated settlement or bank call.
      const payment = await prisma.payment.create({ data: { facilityId: facility, memberId: identities.MEMBER.memberProfile.id, planId, amount: 100000, method: "SEPAY", gateway: "SEPAY", status: "PENDING", transactionCode: `AUDIT-${run}` } });
      assert.equal((await ok("ADMIN", "GET", `/payments/sepay/${payment.id}`)).data.status, "PENDING");
      assert.equal((await ok("MEMBER", "GET", `/payments/sepay/${payment.id}`)).data.paymentId, payment.id);
      assert.equal((await request("COACH", "GET", `/payments/sepay/${payment.id}`)).status, 403);
      assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, "PENDING");
    });
    await check("MANAGER: room/class/coach -> schedule -> list/detail; overlap rejected", async () => {
      roomId = (await ok("MANAGER", "POST", "/rooms", { name: `Audit room ${run}`, capacity: 10, areaType: "INDOOR" })).data.id;
      classId = (await ok("MANAGER", "POST", "/classes", { name: `Audit class ${run}`, sportIds: [sportId], capacity: 5, areaType: "INDOOR", classType: "REGULAR" })).data.id;
      await ok("MANAGER", "POST", `/classes/${classId}/coaches`, { coachId: identities.COACH.coachProfile.id, isPrimary: true });
      const startTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const endTime = new Date(Date.now() + 75 * 60 * 1000).toISOString();
      scheduleId = (await ok("MANAGER", "POST", "/class-schedules", { classId, roomId, startTime, endTime })).data.id;
      assert.equal((await ok("MEMBER", "GET", `/class-schedules/${scheduleId}`)).data.room.id, roomId);
      assert.ok((await ok("MEMBER", "GET", `/class-schedules?classId=${classId}`)).data.some((s: any) => s.id === scheduleId));
      assert.equal((await request("MANAGER", "POST", "/class-schedules", { classId, roomId, startTime, endTime })).status, 409);
    });
    await check("MEMBER: book -> my list -> duplicate rejected -> database", async () => {
      enrollmentId = (await ok("MEMBER", "POST", "/enrollments", { scheduleId })).data.id;
      assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).status, "BOOKED");
      assert.ok((await ok("MEMBER", "GET", "/enrollments/my")).data.some((e: any) => e.id === enrollmentId));
      assert.equal((await request("MEMBER", "POST", "/enrollments", { scheduleId })).status, 409);
    });
    if (process.argv.includes("--browser")) {
      const require = createRequire(fileURLToPath(new URL("../../FE/package.json", import.meta.url)));
      const { chromium, expect } = require("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        for (const role of ["ADMIN", "MANAGER", "RECEPTIONIST", "COACH", "MEMBER"]) {
          await check(`${role}: real browser login -> dashboard -> profile -> reload, no intercepted API`, async () => {
            const context = await browser.newContext({ baseURL: process.env.AUDIT_FE_URL || "http://127.0.0.1:5174" });
            try {
              const page = await context.newPage();
              const errors: string[] = [];
              page.on("pageerror", (e: Error) => errors.push(e.message));
              page.on("response", (r: any) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
              await page.goto("/login");
              await page.getByLabel("Email", { exact: true }).fill(identities[role].email.toUpperCase());
              await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
              await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
              const home = { ADMIN: "admin", MANAGER: "manager", RECEPTIONIST: "receptionist", COACH: "coach", MEMBER: "member" }[role];
              await expect(page).toHaveURL(new RegExp(`/${home}/dashboard$`), { timeout: 60000 });
              await page.getByRole("combobox", { name: "Cơ sở đang làm việc" }).selectOption(facility);
              await page.goto(`/${home}/profile`);
              await expect(page.getByRole("textbox", { name: /Họ và tên/ })).toHaveValue(role === "MEMBER" ? "Audit Updated Member" : `Audit ${role}`, { timeout: 60000 });
              await page.reload();
              await expect(page.getByRole("combobox", { name: "Cơ sở đang làm việc" })).toHaveValue(facility, { timeout: 60000 });
              if (role === "MEMBER") {
                await page.goto("/member/my-classes");
                await expect(page.locator("main")).toContainText(`Audit class ${run}`, { timeout: 60000 });
              }
              await page.waitForLoadState("networkidle", { timeout: 60000 });
              assert.deepEqual(errors, [], "Browser runtime/network failures");
            } finally { await context.close(); }
          });
        }
      } finally { await browser.close(); }
    }
    let attendanceId = "";
    await check("COACH: roster -> manual attendance with Mongo profile ID -> member history", async () => {
      const roster = await ok("COACH", "GET", `/enrollments/schedule/${scheduleId}`);
      assert.ok(roster.data.some((e: any) => e.memberId === identities.MEMBER.memberProfile.id));
      assert.equal((await request("COACH", "POST", "/attendance", { scheduleId, memberId: identities.MEMBER.memberProfile.id, status: "EXCUSED" })).status, 403);
      assert.equal((await request("COACH", "POST", "/attendance", { scheduleId, memberId: "malformed", status: "PRESENT" })).status, 400);
      const result = await ok("COACH", "POST", "/attendance", { scheduleId, memberId: identities.MEMBER.memberProfile.id, status: "PRESENT" });
      attendanceId = result.data.id;
      assert.equal((await prisma.attendance.findUniqueOrThrow({ where: { id: attendanceId } })).status, "PRESENT");
      assert.ok((await ok("MEMBER", "GET", "/attendance/my")).data.some((a: any) => a.id === attendanceId));
      assert.equal((await request("RECEPTIONIST", "POST", "/attendance", { scheduleId, memberId: identities.MEMBER.memberProfile.id, status: "PRESENT" })).status, 403);
      assert.equal((await request("COACH", "PATCH", `/attendance/${attendanceId}`, { status: "EXCUSED", note: "Denied correction" })).status, 403);
      await ok("MANAGER", "PATCH", `/attendance/${attendanceId}`, { status: "LATE", note: "Audited correction" });
    });
    await check("MEMBER: feedback accepts ObjectId; invalid ID rejected", async () => {
      await ok("MEMBER", "POST", "/feedbacks", { coachId: identities.COACH.coachProfile.id, classId, rating: 5, comment: "Audit" });
      assert.equal((await request("MEMBER", "POST", "/feedbacks", { coachId: "malformed", rating: 5 })).status, 400);
    });
    await check("MEMBER cancel -> ADMIN book on behalf -> cancel (inherited permission)", async () => {
      // A recorded attendance prevents cancellation, so remove only this test fixture.
      await prisma.attendance.deleteMany({ where: { scheduleId } });
      await ok("MEMBER", "DELETE", `/enrollments/${enrollmentId}`);
      assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).status, "CANCELLED");
      const result = await ok("ADMIN", "POST", "/enrollments", { scheduleId, memberId: identities.MEMBER.memberProfile.id });
      await ok("ADMIN", "DELETE", `/enrollments/${result.data.id}`);
    });
    await check("MANAGER: cancel schedule -> persisted state; catalog deactivate", async () => {
      await ok("MANAGER", "PATCH", `/class-schedules/${scheduleId}`, { status: "CANCELLED", reason: "Audit cleanup" });
      assert.equal((await prisma.classSchedule.findUniqueOrThrow({ where: { id: scheduleId } })).status, "CANCELLED");
      await ok("MANAGER", "DELETE", `/classes/${classId}`);
      await ok("MANAGER", "DELETE", `/rooms/${roomId}`);
      assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).isActive, false);
    });
    for (const role of Object.keys(identities)) await check(`${role}: logout revokes refresh`, async () => {
      await ok(role, "POST", "/auth/logout", { refreshToken: tokens[role].refreshToken });
      assert.equal((await request("", "POST", "/auth/refresh-token", { refreshToken: tokens[role].refreshToken })).status, 401);
    });
    console.log(JSON.stringify({ passed, failures }, null, 2));
    assert.equal(failures.length, 0, "Integration audit failures");
  } finally {
    if (sockets) await new Promise<void>(resolve => sockets!.close(() => resolve()));
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    // Delete only this run's fixtures, including identities partially created by a failed request.
    const { User } = await import("../src/models/User.js");
    const { RefreshToken } = await import("../src/models/RefreshToken.js");
    const allUsers = [...new Set([...users, ...(await User.find({ email: { $regex: run } })).map(u => u._id.toString())])];
    for (const model of ["coachFeedback", "attendanceManualCode", "attendance", "enrollment", "classSchedule", "classMember", "class", "room", "issue", "leaveRequest", "slot", "schedulePattern", "auditLog", "invoice", "payment", "membershipSubscription", "facilityStaff"] as const) {
      const where = model === "invoice" ? { payment: { facilityId: { in: facilities } } }
        : ["attendance", "attendanceManualCode"].includes(model) ? { schedule: { class: { facilityId: { in: facilities } } } }
        : ["coachFeedback", "enrollment", "classSchedule", "classMember"].includes(model) ? { class: { facilityId: { in: facilities } } }
        : { facilityId: { in: facilities } };
      await (prisma[model] as any).deleteMany({ where });
    }
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    // Registration creates its FREE subscription outside a selected facility.
    await prisma.membershipSubscription.deleteMany({ where: { member: { userId: { in: allUsers } } } });
    if (seededLegacyFacility) await prisma.facility.delete({ where: { id: "legacy-main" } });
    await prisma.membershipPlan.deleteMany({ where: { id: { in: plans } } });
    await prisma.coachSpecialization.deleteMany({ where: { sportId: { in: sports } } });
    await prisma.sport.deleteMany({ where: { id: { in: sports } } });
    await prisma.user.deleteMany({ where: { id: { in: allUsers } } });
    await RefreshToken.deleteMany({ userId: { $in: allUsers } });
    await deleteIdentities(allUsers);
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
