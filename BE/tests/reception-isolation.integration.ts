import dotenv from "dotenv";
dotenv.config({ quiet: true });
import assert from "node:assert/strict";
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
    /^scms_verify_manager_[a-f0-9]{16}$/,
  );
  assert.match(
    new URL(process.env.MONGO_URI!).pathname,
    /^\/scms_verify_manager_[a-f0-9]{16}$/,
  );
  await connectTestMongo();
  const identity = (
    role: "RECEPTIONIST" | "MANAGER" | "MEMBER",
    name: string,
  ) =>
    createIdentity({
      role,
      fullName: name,
      email: `${name}@test.invalid`,
      password: "fixture",
    });
  const reception = await identity("RECEPTIONIST", "reception"),
    manager = await identity("MANAGER", "manager"),
    outsider = await identity("RECEPTIONIST", "outsider"),
    member = await identity("MEMBER", "member"),
    other = await identity("MEMBER", "other");
  const fa = await prisma.facility.create({
    data: { code: "A", name: "A", address: "Test" },
  });
  const fb = await prisma.facility.create({
    data: { code: "B", name: "B", address: "Test" },
  });
  await prisma.facilityStaff.createMany({
    data: [
      { facilityId: fa.id, userId: reception.id, role: "RECEPTIONIST" },
      { facilityId: fa.id, userId: manager.id, role: "MANAGER" },
      { facilityId: fb.id, userId: outsider.id, role: "RECEPTIONIST" },
    ],
  });
  const plan = await prisma.membershipPlan.create({
    data: {
      name: "Global membership",
      price: 100,
      durationDays: 365,
      tier: "MEMBERSHIP",
      maxConcurrentClasses: 5,
    },
  });
  const now = Date.now(),
    start = new Date(now - 30 * 86400000),
    end = new Date(now + 30 * 86400000);
  await prisma.membershipSubscription.create({
    data: {
      memberId: member.memberProfile!.id,
      facilityId: fb.id,
      planId: plan.id,
      tier: "MEMBERSHIP",
      startDate: start,
      endDate: end,
    },
  });
  const room = await prisma.room.create({
    data: {
      facilityId: fa.id,
      name: "A room",
      areaType: "INDOOR",
      capacity: 20,
    },
  });
  const cls = await prisma.class.create({
    data: {
      facilityId: fa.id,
      name: "Yoga A",
      areaType: "INDOOR",
      capacity: 20,
    },
  });
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) {
    const future = i >= 8;
    const schedule = await prisma.classSchedule.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        startTime: new Date(now + (future ? i : -10 + i) * 86400000),
        endTime: new Date(now + (future ? i : -10 + i) * 86400000 + 3600000),
        status: future ? "SCHEDULED" : "COMPLETED",
      },
    });
    ids.push(schedule.id);
    await prisma.enrollment.create({
      data: {
        memberId: member.memberProfile!.id,
        classId: cls.id,
        scheduleId: schedule.id,
        bookedAt: start,
        status: future ? "BOOKED" : "COMPLETED",
      },
    });
    if (i < 7)
      await prisma.attendance.create({
        data: {
          memberId: member.memberProfile!.id,
          scheduleId: schedule.id,
          status: i < 3 ? "ABSENT" : i === 3 ? "LATE" : "PRESENT",
        },
      });
  }
  const app = (await import("../src/app.js")).default;
  const server = (app as any).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  async function request(
    user: { id: string; role: string },
    method: string,
    path: string,
    body?: unknown,
    facilityId?: string,
  ) {
    const res = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken(user)}`,
        "Content-Type": "application/json",
        ...(facilityId ? { "X-Facility-Id": facilityId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json()) as any };
  }
  const pair = { memberId: member.memberProfile!.id, classId: cls.id };
  const detailPath =
    "/attendance/monitoring/detail?" + new URLSearchParams(pair);
  try {
    const list = await request(reception, "GET", "/attendance/monitoring");
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].attendedCount, 4);
    assert.equal(list.body.data[0].absentCount, 3);
    assert.equal(list.body.data[0].unrecordedCount, 1);
    assert.equal(list.body.data[0].status, "VIOLATION");
    assert.equal(
      (await request(reception, "GET", detailPath)).body.data.sessions.length,
      10,
    );
    assert.equal((await request(outsider, "GET", detailPath)).status, 404);
    assert.equal(
      (await request(member, "GET", detailPath, undefined, fa.id)).status,
      403,
    );
    assert.equal(
      (await request(reception, "GET", detailPath, undefined, fb.id)).status,
      403,
    );
    assert.equal(
      (
        await request(
          reception,
          "GET",
          `/attendance/monitoring/detail?memberId=${other.memberProfile!.id}&classId=${cls.id}`,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request(reception, "GET", "/attendance/monitoring?page=0")).status,
      400,
    );
    assert.equal(
      (
        await request(reception, "POST", "/attendance", {
          memberId: pair.memberId,
          scheduleId: ids[7],
          status: "PRESENT",
        })
      ).status,
      403,
    );
    console.log(
      "PASS own class counts, pending attendance, global entitlement, IDOR and facility scope",
    );
    const warnings = await Promise.all(
      [1, 2].map(() =>
        request(reception, "POST", "/attendance/warnings/send", pair),
      ),
    );
    assert.deepEqual(
      warnings.map((w) => w.status),
      [200, 200],
    );
    assert.equal(
      await prisma.notification.count({
        where: { userId: member.id, type: "ATTENDANCE_WARNING" },
      }),
      1,
    );
    const reports = await Promise.all(
      [1, 2].map(() =>
        request(reception, "POST", "/attendance/reports", {
          ...pair,
          reason: "Vắng nhiều buổi, cần xem xét",
        }),
      ),
    );
    assert.deepEqual(reports.map((r) => r.status).sort(), [201, 409]);
    let reportId = reports.find((r) => r.status === 201)!.body.data.reportId;
    assert.ok(
      [403, 404].includes(
        (await request(outsider, "GET", `/issues/${reportId}`)).status,
      ),
    );
    assert.equal(
      (await request(member, "DELETE", `/issues/${reportId}`, undefined, fa.id))
        .status,
      403,
    );
    const report = await prisma.issue.findUniqueOrThrow({
      where: { id: reportId },
    });
    assert.equal(
      (
        await request(reception, "POST", "/issues", {
          title: "Fake attendance report",
          description: report.description,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          reception,
          "POST",
          `/attendance/reports/${reportId}/review`,
          { decision: "APPROVE_REMOVAL", response: "Đồng ý xử lý vi phạm" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(manager, "PATCH", `/issues/${reportId}`, {
          status: "RESOLVED",
          response: "Bypass review",
        })
      ).status,
      403,
    );
    const rejected = await request(
      manager,
      "POST",
      `/attendance/reports/${reportId}/review`,
      { decision: "REJECT", response: "Tiếp tục học, sẽ theo dõi thêm" },
    );
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.equal(
      await prisma.enrollment.count({
        where: { memberId: pair.memberId, status: "BOOKED" },
      }),
      2,
    );
    const resubmitted = await request(
      reception,
      "POST",
      "/attendance/reports",
      { ...pair, reason: "Đề nghị đối chiếu lại chuyên cần" },
    );
    assert.equal(resubmitted.status, 201);
    reportId = resubmitted.body.data.reportId;
    await prisma.attendance.update({
      where: {
        scheduleId_memberId: { memberId: pair.memberId, scheduleId: ids[0] },
      },
      data: { status: "PRESENT" },
    });
    assert.equal(
      (
        await request(
          manager,
          "POST",
          `/attendance/reports/${reportId}/review`,
          {
            decision: "APPROVE_REMOVAL",
            response: "Kiểm tra lại sau khi cập nhật",
          },
        )
      ).status,
      409,
    );
    await prisma.attendance.update({
      where: {
        scheduleId_memberId: { memberId: pair.memberId, scheduleId: ids[0] },
      },
      data: { status: "ABSENT" },
    });
    const approved = await request(
      manager,
      "POST",
      `/attendance/reports/${reportId}/review`,
      {
        decision: "APPROVE_REMOVAL",
        response: "Đã đối chiếu lịch sử chuyên cần",
      },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.data.releasedSessionsCount, 2);
    assert.equal(
      await prisma.enrollment.count({
        where: { memberId: pair.memberId, status: "CANCELLED" },
      }),
      2,
    );
    assert.equal(
      await prisma.attendance.count({ where: { memberId: pair.memberId } }),
      7,
    );
    assert.equal(
      (
        await request(
          member,
          "POST",
          "/enrollments",
          { scheduleId: ids[8] },
          fa.id,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          manager,
          "POST",
          `/attendance/reports/${reportId}/review`,
          { decision: "REJECT", response: "Lần duyệt thứ hai" },
        )
      ).status,
      409,
    );
    console.log(
      "PASS concurrent warning/report deduplication, Manager-only decision and historical preservation",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error?: Error) => (error ? reject(error) : resolve())),
    );
    await disconnectTestMongo();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
