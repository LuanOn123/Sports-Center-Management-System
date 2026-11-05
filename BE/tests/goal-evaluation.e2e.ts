import "dotenv/config";
import type { AddressInfo } from "node:net";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { connectTestMongo, createIdentity, deleteIdentities, disconnectTestMongo } from "./helpers/identity.js";
import { hashPassword } from "../src/utils/bcrypt.js";
import { signAccessToken } from "../src/utils/jwt.js";

const RUN = Date.now().toString(36);
const PASSWORD = "E2eGoal!2026";
const FACILITY_ID = "legacy-main";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let baseUrl = "";
let server: any = null;

type HttpResult = { status: number; body: any };

async function http(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {}
): Promise<HttpResult> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Facility-Id": FACILITY_ID,
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): boolean {
  if (condition) {
    passed++;
    console.log(`  [OK]   ${name}`);
  } else {
    const msg = `${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`;
    failures.push(msg);
    console.log(`  [FAIL] ${msg}`);
  }
  return condition;
}

const created = {
  userIds: [] as string[],
  classIds: [] as string[],
  roomIds: [] as string[],
  scheduleIds: [] as string[],
  planIds: [] as string[],
  termIds: [] as string[],
};

async function createUser(
  role: "MEMBER" | "COACH" | "MANAGER",
  tag: string,
  hashedPassword: string,
  fitnessGoal?: string
) {
  const email = `e2e-goal-${RUN}-${tag.toLowerCase()}@example.com`;
  const user = await createIdentity({
    email,
    password: hashedPassword,
    fullName: `E2E Goal ${tag} ${RUN}`,
    role,
  });
  created.userIds.push(user.id);

  if (role === "MEMBER" && fitnessGoal) {
    await prisma.memberProfile.update({
      where: { userId: user.id },
      data: { fitnessGoal },
    });
  }

  if (role !== "MEMBER") {
    await prisma.facilityStaff.create({
      data: { userId: user.id, facilityId: FACILITY_ID, role: role as any },
    });
  }

  const token = signAccessToken({ id: user.id, role, tokenVersion: 0 });
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId: user.id } });
  const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: user.id } });

  return { id: user.id, email, token, memberProfileId: memberProfile?.id ?? "", coachProfileId: coachProfile?.id ?? "" };
}

async function runTests() {
  console.log(`=== BẮT ĐẦU TEST LUỒNG MỤC TIÊU & ĐÁNH GIÁ TIẾN ĐỘ HỌC VIÊN (${RUN}) ===\n`);

  await connectTestMongo();
  const hashedPassword = await hashPassword(PASSWORD);

  // Khởi động server
  server = app.listen(0);
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Tạo Users
    console.log("--- 1. Thiết lập Người dùng (Manager, Coach, 2 Members) ---");
    const manager = await createUser("MANAGER", "Manager", hashedPassword);
    const coach = await createUser("COACH", "Coach", hashedPassword);
    const member1 = await createUser("MEMBER", "Member1", hashedPassword, "Nâng cao sức bền");
    const member2 = await createUser("MEMBER", "Member2", hashedPassword, "Giảm 3kg mỡ thừa");

    // 2. Tạo Phòng tập và Môn thể thao
    const room = await prisma.room.create({
      data: { facilityId: FACILITY_ID, name: `Phòng Bơi ${RUN}`, capacity: 30, areaType: "POOL" },
    });
    created.roomIds.push(room.id);

    // 3. Tạo Gói tập PREMIUM và cấp cho 2 members
    const plan = await prisma.membershipPlan.create({
      data: {
        name: `Plan Goal Test ${RUN}`,
        tier: "PREMIUM",
        price: 500000,
        durationDays: 30,
        maxConcurrentClasses: 5,
        isActive: true,
      },
    });
    created.planIds.push(plan.id);

    for (const mId of [member1.memberProfileId, member2.memberProfileId]) {
      await prisma.membershipSubscription.create({
        data: {
          memberId: mId,
          planId: plan.id,
          tier: "PREMIUM",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * DAY),
          status: "ACTIVE",
        },
      });
    }

    // 4. Tạo Lớp học & phân công Coach
    const cls = await prisma.class.create({
      data: {
        facilityId: FACILITY_ID,
        name: `Lớp Bơi Lội Mục Tiêu ${RUN}`,
        capacity: 15,
        classType: "PREMIUM",
        areaType: "POOL",
        isActive: true,
      },
    });
    created.classIds.push(cls.id);

    await prisma.classMember.create({
      data: { classId: cls.id, coachId: coach.coachProfileId, isPrimary: true },
    });

    // 5. Lấy hoặc tạo Term và tạo 2 buổi học tương lai (Slot 1 và Slot 2)
    let term = await prisma.term.findFirst({
      where: {
        status: { in: ["PLANNING", "OPEN_REGISTRATION", "IN_PROGRESS"] },
        endDate: { gt: new Date() },
      },
    });
    if (!term) {
      term = await prisma.term.create({
        data: {
          code: `TERM_${RUN}`,
          name: `Kỳ test ${RUN}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 60 * DAY),
          registrationStartDate: new Date(Date.now() - 7 * DAY),
          registrationEndDate: new Date(Date.now() + 30 * DAY),
          status: "OPEN_REGISTRATION",
        },
      });
      created.termIds.push(term.id);
    }

    const sch1 = await prisma.classSchedule.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        termId: term.id,
        coachId: coach.coachProfileId,
        startTime: new Date(Date.now() + 2 * DAY),
        endTime: new Date(Date.now() + 2 * DAY + 90 * 60000),
        status: "SCHEDULED",
      },
    });
    created.scheduleIds.push(sch1.id);

    const sch2 = await prisma.classSchedule.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        termId: term.id,
        coachId: coach.coachProfileId,
        startTime: new Date(Date.now() + 4 * DAY),
        endTime: new Date(Date.now() + 4 * DAY + 90 * 60000),
        status: "SCHEDULED",
      },
    });
    created.scheduleIds.push(sch2.id);

    console.log("-> Đã khởi tạo xong môi trường và dữ liệu mẫu.");

    // TEST CASE 1: Member 1 đăng ký khóa học kèm mục tiêu cụ thể
    console.log("\n--- TEST CASE 1: Member 1 đăng ký khóa học có điền mục tiêu riêng ---");
    const enrollRes1 = await http("POST", "/enrollments/bulk", {
      token: member1.token,
      body: {
        classId: cls.id,
        goal: "Bơi ếch 50m liên tục không nghỉ",
      },
    });
    check("Member 1 đăng ký trọn khóa thành công (HTTP 201)", enrollRes1.status === 201, enrollRes1.body);

    const goalDb1 = await prisma.memberCourseGoal.findUnique({
      where: { memberId_classId: { memberId: member1.memberProfileId, classId: cls.id } },
    });
    check("MemberCourseGoal được tạo với đúng mục tiêu tự nhập", goalDb1?.goal === "Bơi ếch 50m liên tục không nghỉ", goalDb1);
    check("Tiến độ ban đầu là 0%", goalDb1?.progress === 0);
    check("Trạng thái ban đầu là IN_PROGRESS", goalDb1?.status === "IN_PROGRESS");

    // TEST CASE 2: Member 2 đăng ký không điền mục tiêu (Kiểm tra Fallback)
    console.log("\n--- TEST CASE 2: Member 2 đăng ký không điền mục tiêu (Fallback từ Profile) ---");
    const enrollRes2 = await http("POST", "/enrollments/bulk", {
      token: member2.token,
      body: {
        classId: cls.id,
        // Không gửi goal
      },
    });
    check("Member 2 đăng ký trọn khóa thành công (HTTP 201)", enrollRes2.status === 201, enrollRes2.body);

    const goalDb2 = await prisma.memberCourseGoal.findUnique({
      where: { memberId_classId: { memberId: member2.memberProfileId, classId: cls.id } },
    });
    check("Mục tiêu tự động fallback lấy từ fitnessGoal trong profile ('Giảm 3kg mỡ thừa')", goalDb2?.goal === "Giảm 3kg mỡ thừa", goalDb2);
    check("Tiến độ ban đầu của Member 2 cũng là 0%", goalDb2?.progress === 0);

    // TEST CASE 3: Coach truy vấn danh sách học viên và mục tiêu của buổi học 1
    console.log("\n--- TEST CASE 3: Coach xem danh sách học viên và mục tiêu buổi 1 ---");
    const evQueryRes = await http("GET", `/attendance/schedules/${sch1.id}/evaluations`, {
      token: coach.token,
    });
    check("Coach lấy danh sách đánh giá thành công (HTTP 200)", evQueryRes.status === 200, evQueryRes.body);
    const evList = evQueryRes.body?.data || [];
    check("Buổi 1 có đủ 2 học viên trong danh sách", evList.length === 2);
    const m1Item = evList.find((i: any) => i.memberId === member1.memberProfileId);
    check("Hiển thị đúng mục tiêu của Member 1", m1Item?.goal === "Bơi ếch 50m liên tục không nghỉ");
    check("Hiển thị đúng tiến độ hiện tại (0%)", m1Item?.currentProgress === 0);

    // TEST CASE 4: Coach đánh giá Member 1 sau buổi 1: Tiến độ lên 35% kèm lời dặn
    console.log("\n--- TEST CASE 4: Coach đánh giá Member 1 sau buổi 1 (0% -> 35%) ---");
    const evalRes1 = await http("POST", `/attendance/schedules/${sch1.id}/evaluations`, {
      token: coach.token,
      body: {
        memberId: member1.memberProfileId,
        progress: 35,
        description: "Khởi động tốt, đã bơi được 15m đầu tiên đúng form thở",
      },
    });
    check("Coach lưu đánh giá buổi 1 thành công (HTTP 200)", evalRes1.status === 200, evalRes1.body);

    const slotEvalDb1 = await prisma.slotEvaluation.findUnique({
      where: { scheduleId_memberId: { scheduleId: sch1.id, memberId: member1.memberProfileId } },
    });
    check("SlotEvaluation lưu previousProgress = 0", slotEvalDb1?.previousProgress === 0);
    check("SlotEvaluation lưu newProgress = 35", slotEvalDb1?.newProgress === 35);
    check("SlotEvaluation lưu đúng description của Coach", slotEvalDb1?.description === "Khởi động tốt, đã bơi được 15m đầu tiên đúng form thở");

    const goalDb1AfterSlot1 = await prisma.memberCourseGoal.findUnique({
      where: { memberId_classId: { memberId: member1.memberProfileId, classId: cls.id } },
    });
    check("Tiến độ tổng của Member 1 cập nhật thành 35%", goalDb1AfterSlot1?.progress === 35);

    // Kiểm tra Notification đã gửi đến Member 1
    const notif1 = await prisma.notification.findFirst({
      where: { userId: member1.id, type: "GOAL_PROGRESS_UPDATED" as any },
      orderBy: { createdAt: "desc" },
    });
    check("Member 1 nhận được Notification loại GOAL_PROGRESS_UPDATED", Boolean(notif1));
    check("Nội dung Notification chứa tiến độ 35% và lời dặn của Coach", notif1?.body.includes("35%") && notif1?.body.includes("Khởi động tốt"));

    // TEST CASE 5: Coach đánh giá Member 1 sau buổi 2: Tiến độ lên 75%
    console.log("\n--- TEST CASE 5: Coach đánh giá Member 1 sau buổi 2 (35% -> 75%) ---");
    const evalRes2 = await http("POST", `/attendance/schedules/${sch2.id}/evaluations`, {
      token: coach.token,
      body: {
        memberId: member1.memberProfileId,
        progress: 75,
        description: "Đạt cự ly 35m liên tục, kỹ thuật đạp chân rất chuẩn!",
      },
    });
    check("Coach lưu đánh giá buổi 2 thành công (HTTP 200)", evalRes2.status === 200, evalRes2.body);

    const slotEvalDb2 = await prisma.slotEvaluation.findUnique({
      where: { scheduleId_memberId: { scheduleId: sch2.id, memberId: member1.memberProfileId } },
    });
    check("SlotEvaluation 2 lưu previousProgress = 35", slotEvalDb2?.previousProgress === 35);
    check("SlotEvaluation 2 lưu newProgress = 75", slotEvalDb2?.newProgress === 75);

    const goalDb1AfterSlot2 = await prisma.memberCourseGoal.findUnique({
      where: { memberId_classId: { memberId: member1.memberProfileId, classId: cls.id } },
    });
    check("Tiến độ tổng của Member 1 cập nhật thành 75%", goalDb1AfterSlot2?.progress === 75);

    // TEST CASE 6: Member 1 xem mục tiêu, thanh tiến độ và toàn bộ lịch sử lời dặn của HLV
    console.log("\n--- TEST CASE 6: Member 1 xem tiến độ và lịch sử lời dặn (Timeline) ---");
    const myGoalRes = await http("GET", `/attendance/classes/${cls.id}/my-goal`, {
      token: member1.token,
    });
    check("Member lấy thông tin mục tiêu thành công (HTTP 200)", myGoalRes.status === 200, myGoalRes.body);
    const myGoalData = myGoalRes.body?.data;
    check("Tiến độ hiện tại hiển thị chính xác 75%", myGoalData?.progress === 75);
    check("Có đủ 2 buổi học trong lịch sử đánh giá", myGoalData?.evaluations?.length === 2);
    check("Buổi 1: diff = +35%, có lời dặn", myGoalData?.evaluations[0]?.diff === 35 && myGoalData?.evaluations[0]?.description.includes("15m"));
    check("Buổi 2: diff = +40%, có lời dặn", myGoalData?.evaluations[1]?.diff === 40 && myGoalData?.evaluations[1]?.description.includes("35m"));

    // TEST CASE 7: Member không được phép sửa đổi mục tiêu sau khi đã đăng ký khóa học
    console.log("\n--- TEST CASE 7: Member bị chặn sửa mục tiêu sau khi đã đăng ký (Bảo vệ tính toàn vẹn) ---");
    const updateGoalRes = await http("PATCH", `/attendance/classes/${cls.id}/my-goal`, {
      token: member1.token,
      body: { goal: "Bơi 100m không nghỉ và hoàn thiện bơi sải" },
    });
    check("Hệ thống chặn sửa mục tiêu (HTTP 400)", updateGoalRes.status === 400, updateGoalRes.body);

    const goalDbUnchanged = await prisma.memberCourseGoal.findUnique({
      where: { memberId_classId: { memberId: member1.memberProfileId, classId: cls.id } },
    });
    check("Mục tiêu gốc được giữ nguyên an toàn", goalDbUnchanged?.goal === "Bơi ếch 50m liên tục không nghỉ");
    check("Tiến độ vẫn được giữ nguyên (75%)", goalDbUnchanged?.progress === 75);

  } finally {
    // Dọn dẹp fixture
    console.log("\n--- Dọn dẹp dữ liệu kiểm thử ---");
    await prisma.notification.deleteMany({
      where: { userId: { in: created.userIds } },
    }).catch(() => {});
    await prisma.slotEvaluation.deleteMany({
      where: { scheduleId: { in: created.scheduleIds } },
    }).catch(() => {});
    await prisma.memberCourseGoal.deleteMany({
      where: { classId: { in: created.classIds } },
    }).catch(() => {});
    await prisma.attendance.deleteMany({
      where: { scheduleId: { in: created.scheduleIds } },
    }).catch(() => {});
    await prisma.enrollment.deleteMany({
      where: { scheduleId: { in: created.scheduleIds } },
    }).catch(() => {});
    await prisma.classSchedule.deleteMany({
      where: { id: { in: created.scheduleIds } },
    }).catch(() => {});
    await prisma.classMember.deleteMany({
      where: { classId: { in: created.classIds } },
    }).catch(() => {});
    await prisma.class.deleteMany({
      where: { id: { in: created.classIds } },
    }).catch(() => {});
    await prisma.membershipSubscription.deleteMany({
      where: { planId: { in: created.planIds } },
    }).catch(() => {});
    await prisma.membershipPlan.deleteMany({
      where: { id: { in: created.planIds } },
    }).catch(() => {});
    await prisma.room.deleteMany({
      where: { id: { in: created.roomIds } },
    }).catch(() => {});
    await prisma.term.deleteMany({
      where: { id: { in: created.termIds } },
    }).catch(() => {});
    await prisma.facilityStaff.deleteMany({
      where: { userId: { in: created.userIds } },
    }).catch(() => {});
    await deleteIdentities(created.userIds).catch(() => {});
    await disconnectTestMongo().catch(() => {});

    if (server) server.close();
  }

  console.log(`\n=========================================`);
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failures.length} FAIL`);
  if (failures.length > 0) {
    console.error("Các kiểm tra thất bại:", failures);
    process.exit(1);
  } else {
    console.log("TẤT CẢ CÁC KIỂM TRA ĐỀU THÀNH CÔNG RỰC RỠ! 🎉");
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  if (server) server.close();
  process.exit(1);
});
