import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { prisma } from "../src/config/prisma.js";
import { configureDns } from "../src/config/dns.js";

async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  assert.match(new URL(process.env.MONGO_URI!).pathname, /^\/scms_verify_/);
  configureDns();
  await mongoose.connect(process.env.MONGO_URI!, {
    serverSelectionTimeoutMS: 15000,
  });
  const { User } = await import("../src/models/User.js");
  const { CoachProfile } = await import("../src/models/CoachProfile.js");
  const { MemberProfile } = await import("../src/models/MemberProfile.js");
  const { ManagerProfile } = await import("../src/models/ManagerProfile.js");
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const run = randomUUID();
  const users: string[] = [],
    facilities: string[] = [];
  let server: Server | undefined;
  try {
    const tokens: Record<string, string> = {},
      ids: Record<string, string> = {};
    for (const role of [
      "ADMIN",
      "MANAGER",
      "RECEPTIONIST",
      "MEMBER",
      "OTHER_MEMBER",
    ]) {
      const actual = role === "OTHER_MEMBER" ? "MEMBER" : role;
      const user = await User.create({
        email: `${run}-${role}@test.invalid`,
        fullName: role,
        password: "test-hash",
        role: actual,
      });
      const id = user._id.toString();
      users.push(id);
      ids[role] = id;
      await prisma.user.create({
        data: {
          id,
          email: user.email,
          fullName: role,
          password: "test-hash",
          role: actual as any,
        },
      });
      tokens[role] = signAccessToken({ id, role: actual });
    }
    const app = (await import("../src/app.js")).default;
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const port = (server.address() as any).port;
    // Public landing assistant stays public. Disable the provider for this test;
    // a 503 confirms the request reached the handler without making an API call.
    delete process.env.GROQ_API_KEY;
    const publicAssistant = await fetch(
      `http://127.0.0.1:${port}/api/v1/ai/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Thông tin gói tập" }),
      },
    );
    assert.equal(publicAssistant.status, 503);
    console.log(
      "PASS HTTP: public assistant reaches its handler without authentication or facility headers",
    );
    const request = async (
      role: string,
      method: string,
      path: string,
      facility?: string,
      body?: unknown,
    ) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${tokens[role]}`,
          ...(facility ? { "X-Facility-Id": facility } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, ...(await response.json()) };
    };
    for (const code of ["A", "B"]) {
      const f = await request("ADMIN", "POST", "/facilities", undefined, {
        code: run + code,
        name: code,
        address: "Test address",
      });
      assert.equal(f.status, 201);
      facilities.push(f.data.id);
    }
    for (const role of ["MANAGER", "RECEPTIONIST"])
      assert.equal(
        (
          await request(
            "ADMIN",
            "POST",
            `/facilities/${facilities[0]}/staff`,
            undefined,
            { userId: ids[role], role },
          )
        ).status,
        201,
      );
    assert.equal((await request("MANAGER", "GET", "/rooms")).status, 400);
    assert.equal(
      (await request("MANAGER", "GET", "/rooms", facilities[1])).status,
      403,
    );
    const a = await request("MANAGER", "POST", "/rooms", facilities[0], {
      name: run + "roomA",
      capacity: 10,
      areaType: "INDOOR",
    });
    assert.equal(a.status, 201);
    const b = await request("ADMIN", "POST", "/rooms", facilities[1], {
      name: run + "roomB",
      capacity: 10,
      areaType: "INDOOR",
    });
    assert.equal(b.status, 201);
    const cross = await request(
      "MANAGER",
      "GET",
      `/rooms/${b.data.id}`,
      facilities[0],
    );
    assert.equal(cross.status, 403);
    assert.equal(cross.message, "FORBIDDEN_SCOPE");
    assert.equal(
      (
        await request("MANAGER", "POST", "/rooms", facilities[0], {
          facilityId: facilities[1],
          name: "invalid",
          capacity: 10,
          areaType: "INDOOR",
        })
      ).status,
      400,
    );
    console.log(
      "PASS HTTP: missing context, unassigned facility, cross-ID access and contradictory context",
    );
    assert.equal(
      (
        await request(
          "RECEPTIONIST",
          "PATCH",
          `/membership-plans/${randomUUID()}`,
          facilities[0],
          { price: 999 },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request("RECEPTIONIST", "POST", "/users", facilities[0], {
          role: "ADMIN",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "MANAGER",
          "POST",
          `/facilities/${facilities[0]}/staff`,
          undefined,
          { userId: ids.MANAGER, role: "MANAGER" },
        )
      ).status,
      403,
    );
    console.log(
      "PASS HTTP: receptionist cannot change prices or create admin; manager cannot assign manager",
    );
    const issue = await request("MEMBER", "POST", "/issues", facilities[0], {
      title: "Locker problem",
      description: "Locker door is stuck",
    });
    assert.equal(issue.status, 200);
    assert.equal(
      (
        await request(
          "OTHER_MEMBER",
          "GET",
          `/issues/${issue.data.id}`,
          facilities[0],
        )
      ).status,
      404,
    );
    assert.deepEqual(
      (await request("MEMBER", "GET", "/issues", facilities[1])).data,
      [],
    );
    assert.equal(
      (
        await request(
          "MEMBER",
          "PUT",
          `/issues/${issue.data.id}`,
          facilities[0],
          { title: "Locker problem", description: "Updated description" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "RECEPTIONIST",
          "PATCH",
          `/issues/${issue.data.id}`,
          facilities[0],
          { status: "RESOLVED", response: "Locker repaired" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "MEMBER",
          "DELETE",
          `/issues/${issue.data.id}`,
          facilities[0],
        )
      ).status,
      404,
    );
    const audit = await request("MANAGER", "GET", "/audit-logs", facilities[0]);
    assert.equal(audit.status, 200);
    assert(
      audit.data.some(
        (r: any) =>
          r.entity === "Issue" && r.action === "update" && r.before && r.after,
      ),
    );
    console.log(
      "PASS HTTP: ticket privacy, facility isolation, update/response rules and audit snapshots",
    );
    const coach = await request("ADMIN", "POST", "/users", facilities[0], {
      email: run + "-coach@test.invalid",
      fullName: "New coach",
      password: "TestPassword123!",
      role: "COACH",
    });
    assert.equal(coach.status, 201);
    users.push(coach.data.id);
    assert.match(coach.data.id, /^[a-f0-9]{24}$/);
    assert.match(coach.data.coachProfile.id, /^[a-f0-9]{24}$/);
    assert.equal(
      (
        await prisma.coachProfile.findUniqueOrThrow({
          where: { userId: coach.data.id },
        })
      ).id,
      coach.data.coachProfile.id,
    );
    console.log(
      "PASS HTTP: MongoDB account/profile creation matches PostgreSQL relational projection IDs",
    );
    const legacyUserId = randomUUID(),
      legacyCoachId = randomUUID();
    await prisma.user.update({
      where: { id: coach.data.id },
      data: { id: legacyUserId },
    });
    await prisma.coachProfile.update({
      where: { userId: legacyUserId },
      data: { id: legacyCoachId },
    });
    const cls = await prisma.class.create({
      data: {
        facilityId: facilities[0],
        name: run + "legacy-class",
        areaType: "INDOOR",
        capacity: 10,
        coaches: { create: { coachId: legacyCoachId } },
      },
    });
    const { synchronizeUserProjection } =
      await import("../src/modules/users/user-projection.service.js");
    await synchronizeUserProjection(coach.data.id);
    assert.equal(
      (
        await prisma.coachProfile.findUniqueOrThrow({
          where: { userId: coach.data.id },
        })
      ).id,
      coach.data.coachProfile.id,
    );
    assert.equal(
      (
        await prisma.classMember.findFirstOrThrow({
          where: { classId: cls.id },
        })
      ).coachId,
      coach.data.coachProfile.id,
    );
    console.log(
      "PASS identity migration: legacy UUIDs become ObjectIds while class assignments survive via cascade",
    );
  } finally {
    if (server)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    await prisma.issue.deleteMany({
      where: { facilityId: { in: facilities } },
    });
    await prisma.auditLog.deleteMany({
      where: { facilityId: { in: facilities } },
    });
    await prisma.classMember.deleteMany({
      where: { class: { facilityId: { in: facilities } } },
    });
    await prisma.class.deleteMany({
      where: { facilityId: { in: facilities } },
    });
    await prisma.room.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await Promise.all([
      User.deleteMany({ email: { $regex: run } }),
      CoachProfile.deleteMany({ userId: { $in: users } }),
      MemberProfile.deleteMany({ userId: { $in: users } }),
      ManagerProfile.deleteMany({ userId: { $in: users } }),
    ]);
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
