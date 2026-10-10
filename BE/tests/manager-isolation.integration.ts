import dotenv from "dotenv";
dotenv.config({ quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/config/prisma.js";
import {
  createIdentity,
  connectTestMongo,
  disconnectTestMongo,
} from "./helpers/identity.js";
import { signAccessToken } from "../src/utils/jwt.js";

async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_manager_/,
  );
  assert.match(
    new URL(process.env.MONGO_URI!).pathname,
    /^\/scms_verify_manager_/,
  );
  await connectTestMongo();
  const run = randomUUID();
  const identity = async (
    role: "ADMIN" | "MANAGER" | "COACH" | "MEMBER" | "RECEPTIONIST",
    name: string,
  ) =>
    createIdentity({
      email: `${run}-${name}@test.invalid`,
      password: "test-hash",
      fullName: name,
      role,
    });
  const admin = await identity("ADMIN", "admin");
  const a = await identity("MANAGER", "manager-a"),
    b = await identity("MANAGER", "manager-b"),
    extra = await identity("MANAGER", "manager-extra");
  const member = await identity("MEMBER", "member");
  const facility = (name: string) =>
    prisma.facility.create({
      data: { code: run + name, name, address: "Test" },
    });
  const fa = await facility("A"),
    fb = await facility("B");
  const app = (await import("../src/app.js")).default;
  const server = (app as any).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const tokens = new Map<string, string>();
  const request = async (
    user: { id: string; role: string },
    method: string,
    path: string,
    body?: unknown,
    facilityId?: string,
  ) => {
    if (!tokens.has(user.id))
      tokens.set(user.id, signAccessToken({ id: user.id, role: user.role }));
    const res = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${tokens.get(user.id)}`,
        "Content-Type": "application/json",
        ...(facilityId ? { "X-Facility-Id": facilityId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const ok = async (...args: Parameters<typeof request>) => {
    const result = await request(...args);
    assert.ok(
      result.status < 300,
      `${args[1]} ${args[2]}: ${result.status} ${result.body.message}`,
    );
    return result.body.data;
  };
  const denied = async (...args: Parameters<typeof request>) => {
    const r = await request(...args);
    assert.ok(
      [403, 404].includes(r.status),
      `Expected scope denial: ${args[2]} got ${r.status}`,
    );
  };
  try {
    await ok(admin, "POST", `/facilities/${fa.id}/staff`, {
      userId: a.id,
      role: "MANAGER",
    });
    await ok(admin, "POST", `/facilities/${fb.id}/staff`, {
      userId: b.id,
      role: "MANAGER",
    });
    assert.equal(
      (
        await request(admin, "POST", `/facilities/${fa.id}/staff`, {
          userId: extra.id,
          role: "MANAGER",
        })
      ).status,
      409,
    );
    const coach = await ok(admin, "POST", "/users", {
      email: `${run}-newcoach@test.invalid`,
      fullName: "New coach",
      password: "Password!123",
      role: "COACH",
    });
    assert.equal(coach.assignmentStatus, "UNASSIGNED");
    assert.equal(
      await prisma.facilityStaff.count({ where: { userId: coach.id } }),
      0,
    );
    const coachActor = { id: coach.id, role: "COACH" };
    const login = await ok(coachActor, "POST", "/auth/login", {
      email: `${run}-newcoach@test.invalid`,
      password: "Password!123",
    });
    assert.equal(typeof login.accessToken, "string");
    // Reuse the pre-assignment login token for all subsequent Coach requests.
    tokens.set(coach.id, login.accessToken);
    await denied(extra, "GET", "/rooms");
    assert.equal(
      (await ok(coachActor, "GET", "/auth/me")).assignmentStatus,
      "UNASSIGNED",
    );
    assert.equal((await ok(coachActor, "GET", "/facilities")).length, 0);
    assert.ok(
      (await ok(a, "GET", "/staff-candidates")).some(
        (u: any) => u.id === coach.id,
      ),
    );
    await denied(a, "POST", `/facilities/${fb.id}/staff`, {
      userId: coach.id,
      role: "COACH",
    });
    await ok(a, "POST", `/facilities/${fa.id}/staff`, {
      userId: coach.id,
      role: "COACH",
    });
    assert.equal(
      (
        await request(b, "POST", `/facilities/${fb.id}/staff`, {
          userId: coach.id,
          role: "COACH",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(a, "POST", `/facilities/${fa.id}/staff`, {
          userId: coach.id,
          role: "COACH",
        })
      ).status,
      409,
    );
    assert.equal(
      (await ok(coachActor, "GET", "/auth/me")).facilityAssignments[0].facility
        .id,
      fa.id,
    );
    assert.ok(
      !(await ok(b, "GET", "/staff-candidates")).some(
        (u: any) => u.id === coach.id,
      ),
    );
    await denied(b, "GET", `/coaches/${coach.id}`);
    assert.equal((await ok(b, "GET", "/coaches")).length, 0);
    const roomA = await ok(a, "POST", "/rooms", {
      name: run + "Room A",
      capacity: 20,
      areaType: "INDOOR",
    });
    const roomB = await ok(b, "POST", "/rooms", {
      name: run + "Room B",
      capacity: 20,
      areaType: "INDOOR",
    });
    assert.equal(roomA.facilityId, fa.id);
    for (const method of ["GET", "PATCH", "DELETE"])
      await denied(
        a,
        method,
        `/rooms/${roomB.id}`,
        method === "PATCH" ? { name: "tampered" } : undefined,
      );
    await denied(a, "GET", `/rooms?facilityId=${fb.id}`);
    await denied(a, "GET", "/rooms", undefined, fb.id);
    await denied(a, "POST", "/rooms", {
      facilityId: fb.id,
      name: "tampered",
      capacity: 20,
      areaType: "INDOOR",
    });
    await denied(a, "PUT", `/rooms/${roomB.id}/capabilities`, { values: {} });
    const sport = await prisma.sport.create({
      data: { name: run, areaTypes: ["INDOOR"] },
    });
    const ca = await ok(a, "POST", "/classes", {
      name: "Class A",
      sportIds: [sport.id],
      capacity: 10,
      areaType: "INDOOR",
      defaultRoomId: roomA.id,
    });
    const cb = await ok(b, "POST", "/classes", {
      name: "Class B",
      sportIds: [sport.id],
      capacity: 10,
      areaType: "INDOOR",
      defaultRoomId: roomB.id,
    });
    await denied(a, "PATCH", `/classes/${cb.id}`, { name: "tampered" });
    await denied(a, "POST", "/classes", {
      name: "tampered",
      sportIds: [sport.id],
      capacity: 10,
      areaType: "INDOOR",
      defaultRoomId: roomB.id,
    });
    await denied(b, "POST", `/classes/${cb.id}/coaches`, {
      coachId: coach.coachProfile.id,
      isPrimary: true,
    });
    await ok(a, "PUT", `/coaches/${coach.coachProfile.id}/specializations`, {
      sportIds: [sport.id],
    });
    await ok(a, "POST", `/classes/${ca.id}/coaches`, {
      coachId: coach.coachProfile.id,
      isPrimary: true,
    });
    const startTime = "2099-10-08T02:00:00.000Z",
      endTime = "2099-10-08T03:00:00.000Z";
    const schedule = await ok(a, "POST", "/class-schedules", {
      classId: ca.id,
      roomId: roomA.id,
      startTime,
      endTime,
    });
    await denied(b, "GET", `/class-schedules/${schedule.id}`);
    const conflict = await request(a, "POST", "/class-schedules", {
      classId: ca.id,
      roomId: roomA.id,
      startTime,
      endTime,
    });
    assert.ok([400, 409].includes(conflict.status));
    assert.ok(
      (await ok(a, "GET", `/class-schedules?roomId=${roomA.id}`)).some(
        (s: any) => s.id === schedule.id,
      ),
    );
    assert.ok(
      [400, 409].includes(
        (await request(a, "DELETE", `/rooms/${roomA.id}`)).status,
      ),
    );
    const leave = await prisma.leaveRequest.create({
      data: {
        facilityId: fb.id,
        coachId: coach.coachProfile.id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        reason: "Test leave",
      },
    });
    await denied(a, "PATCH", `/leave-requests/${leave.id}`, {
      status: "REJECTED",
      reason: "tampered",
    });
    const issue = await prisma.issue.create({
      data: {
        facilityId: fb.id,
        memberId: member.id,
        title: "Test issue",
        description: "Test description",
      },
    });
    await denied(a, "GET", `/issues/${issue.id}`);
    await denied(a, "PATCH", `/issues/${issue.id}`, {
      status: "CLOSED",
      response: "tampered",
    });
    await prisma.payment.create({
      data: {
        facilityId: fb.id,
        memberId: member.memberProfile!.id,
        amount: 777777,
        method: "CASH",
        status: "SUCCESS",
        paidAt: new Date("2099-10-08T05:00:00Z"),
      },
    });
    const reportPath =
      "/reports/revenue?startDate=2099-10-01&endDate=2099-10-31";
    assert.equal((await ok(a, "GET", reportPath)).totalRevenue, 0);
    assert.equal((await ok(b, "GET", reportPath)).totalRevenue, 777777);
    await denied(a, "GET", reportPath, undefined, fb.id);
    await denied(a, "GET", "/payments");
    await denied(a, "GET", `/members/${member.id}`);
    await denied(a, "POST", "/subscriptions", {
      memberId: member.id,
      planId: "tampered",
    });
    await denied(a, "GET", "/invoices");
    await denied(
      a,
      "GET",
      "/reports/members?startDate=2099-10-01&endDate=2099-10-31",
    );
    const racingCoach = await identity("COACH", "race-coach");
    const race = await Promise.all([
      request(a, "POST", `/facilities/${fa.id}/staff`, {
        userId: racingCoach.id,
        role: "COACH",
      }),
      request(b, "POST", `/facilities/${fb.id}/staff`, {
        userId: racingCoach.id,
        role: "COACH",
      }),
    ]);
    assert.deepEqual(race.map((result) => result.status).sort(), [201, 409]);
    assert.equal(
      await prisma.facilityStaff.count({
        where: { userId: racingCoach.id, isActive: true },
      }),
      1,
    );
    await denied(b, "PATCH", `/coaches/${coach.id}`, { fullName: "tampered" });
    await denied(
      b,
      "PUT",
      `/coaches/${coach.coachProfile.id}/specializations`,
      { sportIds: [sport.id] },
    );
    assert.equal((await ok(a, "GET", "/leave-requests")).length, 0);
    assert.equal((await ok(a, "GET", "/issues")).length, 0);
    assert.equal(
      (
        await ok(b, "PATCH", `/issues/${issue.id}`, {
          status: "RESOLVED",
          response: "Resolved locally",
        })
      ).status,
      "RESOLVED",
    );
    assert.equal(
      (
        await ok(b, "PATCH", `/leave-requests/${leave.id}`, {
          status: "REJECTED",
          reason: "Reviewed locally",
        })
      ).status,
      "REJECTED",
    );
    await ok(a, "PATCH", `/rooms/${roomA.id}`, { name: "Updated room A" });
    const disposableRoom = await ok(a, "POST", "/rooms", {
      name: "Unused room",
      capacity: 10,
      areaType: "INDOOR",
    });
    await ok(a, "DELETE", `/rooms/${disposableRoom.id}`);
    assert.equal(
      (
        await prisma.room.findUniqueOrThrow({
          where: { id: disposableRoom.id },
        })
      ).isActive,
      false,
    );
    await assert.rejects(
      prisma.facilityStaff.create({
        data: { userId: extra.id, facilityId: fa.id, role: "MANAGER" },
      }),
      { code: "P2002" },
    );
    await assert.rejects(
      prisma.facilityStaff.create({
        data: { userId: coach.id, facilityId: fb.id, role: "COACH" },
      }),
      { code: "P2002" },
    );
    const reception = await identity("RECEPTIONIST", "reception-a");
    await ok(a, "POST", `/facilities/${fa.id}/staff`, {
      userId: reception.id,
      role: "RECEPTIONIST",
    });
    const period = {
      startTime: "2031-01-02T08:00:00.000Z",
      endTime: "2031-01-02T12:00:00.000Z",
      reason: "Family appointment",
    };
    const staffLeave = await ok(
      reception,
      "POST",
      "/leave-requests",
      {
        ...period,
        requesterId: b.id,
        requesterRole: "MANAGER",
        coachId: coach.coachProfile.id,
      },
      fa.id,
    );
    assert.equal(staffLeave.requesterId, reception.id);
    assert.equal(staffLeave.requesterRole, "RECEPTIONIST");
    assert.equal(staffLeave.coachId, null);
    assert.deepEqual(
      await ok(a, "GET", `/leave-requests/${staffLeave.id}/affected`),
      [],
    );
    await denied(b, "PATCH", `/leave-requests/${staffLeave.id}`, {
      status: "APPROVED",
      reason: "Outside facility",
    });
    await denied(reception, "POST", "/leave-requests", period, fb.id);
    const beforeSchedules = await prisma.classSchedule.findMany({
      orderBy: { id: "asc" },
    });
    assert.equal(
      (
        await request(a, "PATCH", `/leave-requests/${staffLeave.id}`, {
          status: "APPROVED",
          reason: "Invalid resolution",
          resolutions: [{ scheduleId: "arbitrary", action: "CANCEL" }],
        })
      ).status,
      400,
    );
    await ok(a, "PATCH", `/leave-requests/${staffLeave.id}`, {
      status: "APPROVED",
      reason: "Reviewed staff leave",
    });
    assert.deepEqual(
      await prisma.classSchedule.findMany({ orderBy: { id: "asc" } }),
      beforeSchedules,
    );
    const coachLeave = await ok(
      coachActor,
      "POST",
      "/leave-requests",
      period,
      fa.id,
    );
    assert.equal(coachLeave.coachId, coach.coachProfile.id);
    assert.equal(coachLeave.requesterId, coach.id);
    assert.deepEqual(
      (await ok(reception, "GET", "/leave-requests", undefined, fa.id)).map(
        (r: any) => r.id,
      ),
      [staffLeave.id],
    );
    assert.ok(
      !(await ok(coachActor, "GET", "/leave-requests", undefined, fa.id)).some(
        (r: any) => r.id === staffLeave.id,
      ),
    );
    assert.equal(
      (await ok(a, "GET", "/leave-requests")).find(
        (r: any) => r.id === staffLeave.id,
      ).requester.fullName,
      "reception-a",
    );
    await ok(a, "PATCH", `/leave-requests/${coachLeave.id}`, {
      status: "APPROVED",
      reason: "No conflicting sessions",
    });
    const staffIssue = await ok(
      reception,
      "POST",
      "/issues",
      {
        title: "Reception request",
        description: "Equipment needs attention",
        requesterId: b.id,
      },
      fa.id,
    );
    assert.equal(staffIssue.memberId, null);
    assert.equal(staffIssue.requesterId, reception.id);
    const coachIssue = await ok(
      coachActor,
      "POST",
      "/issues",
      { title: "Coach request", description: "Need new training equipment" },
      fa.id,
    );
    assert.deepEqual(
      (await ok(coachActor, "GET", "/issues", undefined, fa.id)).map(
        (r: any) => r.id,
      ),
      [coachIssue.id],
    );
    await denied(
      coachActor,
      "GET",
      `/issues/${staffIssue.id}`,
      undefined,
      fa.id,
    );
    await denied(b, "GET", `/issues/${staffIssue.id}`);
    await denied(b, "PATCH", `/issues/${staffIssue.id}`, {
      status: "RESOLVED",
      response: "Not my facility",
    });
    assert.equal(
      (await ok(a, "GET", "/issues")).find((r: any) => r.id === staffIssue.id)
        .requester.role,
      "RECEPTIONIST",
    );
    await ok(a, "PATCH", `/issues/${staffIssue.id}`, {
      status: "RESOLVED",
      response: "Equipment scheduled for repair",
    });
    const memberIssue = await ok(
      member,
      "POST",
      "/issues",
      { title: "Member request", description: "Need information about class" },
      fa.id,
    );
    assert.equal(memberIssue.memberId, member.id);
    assert.ok(
      (await ok(member, "GET", "/issues", undefined, fa.id)).every(
        (r: any) => r.memberId === member.id,
      ),
    );
    console.log(
      "PASS Manager facility IDOR, staff assignment, unassigned Coach/current-user, room/class/schedule conflicts, leave/support and revenue isolation",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    await disconnectTestMongo();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
