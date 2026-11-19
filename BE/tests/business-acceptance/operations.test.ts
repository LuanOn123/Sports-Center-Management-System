import { at, cases, DAY, MINUTE, schemaCases, withFixture } from "./support.js";
import assert from "node:assert/strict";
import { validateResources } from "../../src/modules/operations/scheduling.js";
import { expandPattern } from "../../src/modules/operations/rules.js";
import { effectiveCoachIds } from "../../src/modules/operations/effective-coaches.js";
import { termRegistrationBlocker, withTermStatus } from "../../src/modules/terms/term-status.js";
import { CreateTermSchema } from "../../src/modules/terms/terms.schema.js";
import { setUserFacility } from "../../src/modules/users/user-facility.service.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/config/prisma.js";
import { User } from "../../src/models/User.js";
import { listUsers } from "../../src/modules/users/users.service.js";

cases("BR-USER-FACILITY-FILTER", [
  ["danh sách mặc định toàn hệ thống", undefined],
  ["lọc nhân sự theo cơ sở trước khi phân trang", "facility-a"],
] as const, async ([, facilityId]) => {
  let filter: Record<string, unknown> = {};
  let assignmentReads = 0;
  const chain = {
    skip: () => chain, limit: () => chain, sort: () => chain, lean: async () => [],
  };
  await withFixture([
    [prisma.facilityStaff, "findMany", ({ where }) => {
      assignmentReads++;
      assert.equal(where.isActive, true);
      assert.equal(where.facility.isActive, true);
      assert.equal(where.facilityId, facilityId);
      return [{ userId: "staff-a" }];
    }],
    [User, "countDocuments", (where) => { filter = where; return 0; }],
    [User, "find", () => chain],
  ], async () => {
    await listUsers({ facilityId });
    assert.equal(assignmentReads, facilityId ? 1 : 0);
    assert.deepEqual(filter._id, facilityId ? { $in: ["staff-a"] } : undefined);
  });
});

cases<readonly [string, "MANAGER" | "COACH" | "RECEPTIONIST", string | null, string?]>("BR-USER-FACILITY", [
  ["chuyển lễ tân và giữ một phân công hoạt động", "RECEPTIONIST", "new"],
  ["gỡ phân công lễ tân", "RECEPTIONIST", null],
  ["không thay quản lý đang phụ trách cơ sở đích", "MANAGER", "occupied", "Cơ sở đã có quản lý"],
  ["không phân công cơ sở ngừng hoạt động", "RECEPTIONIST", "inactive", "ngừng hoạt động"],
  ["không chuyển HLV còn lớp học", "COACH", "new", "HLV còn phân công"],
], async ([, role, facilityId, error]) => {
  const writes: unknown[] = [];
  const db = {
    $executeRaw: async () => [],
    facility: { findUnique: async () => ({ id: facilityId, isActive: facilityId !== "inactive" }) },
    facilityStaff: {
      findMany: async () => [{ userId: "staff", facilityId: "old", role, isActive: true }],
      findFirst: async () => facilityId === "occupied" ? { userId: "other" } : null,
      updateMany: async (args: unknown) => { writes.push(args); return { count: 1 }; },
      upsert: async (args: unknown) => { writes.push(args); return {}; },
    },
    coachProfile: { findUnique: async () => ({ id: "coach" }) },
    class: { count: async () => 1 },
    classSchedule: { count: async () => 0 },
  };
  const run = setUserFacility(db as unknown as Prisma.TransactionClient, "staff", role, facilityId);
  if (error) {
    await assert.rejects(run, new RegExp(error));
    assert.equal(writes.length, 0);
  } else {
    await run;
    assert.equal(writes.length, facilityId ? 2 : 1);
    assert.deepEqual(writes[0], { where: { userId: "staff", isActive: true }, data: { isActive: false } });
  }
});

type Resource = {
  classInactive?: boolean; noClass?: boolean; roomInactive?: boolean; noRoom?: boolean;
  otherFacility?: boolean; capacity?: number; area?: string; equipment?: number;
  required?: number; snapshot?: Record<string, number>; primary?: number; assistant?: boolean;
  replacement?: string; coachError?: "inactive" | "missing" | "unassigned" | "unspecialized";
  leave?: readonly [number, number]; batch?: boolean;
};
cases<readonly [string, Resource, string?]>("BR-SCHED-RESOURCE", [
  ["phòng đủ sức chứa và HLV đúng môn", {}],
  ["lớp chưa tồn tại không thể lên lịch", { noClass: true }, "Invalid facility resources"],
  ["lớp ngừng hoạt động không thể lên lịch", { classInactive: true }, "Invalid facility resources"],
  ["phòng chưa tồn tại không thể lên lịch", { noRoom: true }, "Invalid facility resources"],
  ["phòng ngừng hoạt động không thể lên lịch", { roomInactive: true }, "Invalid facility resources"],
  ["phòng của cơ sở khác không thể dùng", { otherFacility: true }, "Invalid facility resources"],
  ["phòng vừa đủ sĩ số lớp dùng được", { capacity: 12 }],
  ["phòng thiếu một chỗ không dùng được", { capacity: 11 }, "Room capacity or area"],
  ["phòng sai loại khu vực bị chặn", { area: "POOL" }, "Room capacity or area"],
  ["lớp không yêu cầu thiết bị có thể sử dụng phòng trống", { equipment: 0, required: 0 }],
  ["lớp indoor có yêu cầu bị chặn nếu phòng trống", { equipment: 0 }, "ROOM_CAPABILITY_MISSING"],
  ["thiết bị ở phòng có số lượng dương đủ điều kiện indoor", { equipment: 1, required: 20 }],
  ["dữ liệu snapshot không yêu cầu thiết bị được giữ khi catalog đổi", { equipment: 0, snapshot: { mats: 0 } }],
  ["snapshot vẫn cần thiết bị khi catalog bỏ yêu cầu", { equipment: 0, required: 0, snapshot: { mats: 1 } }, "ROOM_CAPABILITY_MISSING"],
  ["lớp thiếu HLV chính không thể lên lịch", { primary: 0, assistant: true }, "đúng một HLV chính"],
  ["lớp có hai HLV chính không thể lên lịch", { primary: 2 }, "đúng một HLV chính"],
  ["HLV thay thế vẫn giữ HLV hỗ trợ", { replacement: "substitute", assistant: true }],
  ["HLV không tồn tại bị chặn", { coachError: "missing" }, "COACH_NOT_ASSIGNED"],
  ["HLV inactive bị chặn", { coachError: "inactive" }, "COACH_NOT_ASSIGNED"],
  ["HLV không được phân công cơ sở bị chặn", { coachError: "unassigned" }, "COACH_NOT_ASSIGNED"],
  ["HLV không có chuyên môn của lớp bị chặn", { coachError: "unspecialized" }, "COACH_SPECIALIZATION_REQUIRED"],
  ["đơn nghỉ hết đúng khi buổi học bắt đầu không gây trùng", { leave: [-30, 0] }],
  ["đơn nghỉ bắt đầu đúng khi buổi học kết thúc không gây trùng", { leave: [60, 90] }],
  ["nghỉ giao với đầu buổi thì chặn lịch", { leave: [-30, 1] }, "COACH_ON_LEAVE"],
  ["nghỉ trùng buổi thứ hai thì chặn lô", { leave: [120, 130], batch: true }, "COACH_ON_LEAVE"],
], async ([, setup, error]) => {
  const reads: string[] = [];
  const assistants = setup.assistant ? [{ coachId: "assistant", isPrimary: false }] : [];
  const db = {
    class: { findUnique: async () => setup.noClass ? null : {
      facilityId: "facility-a", isActive: !setup.classInactive, capacity: 12, areaType: "INDOOR",
      sports: [{ id: "sport", requirements: [{ key: "mats", minimum: setup.required ?? 2 }] }],
      requirementsSnapshot: setup.snapshot,
      coaches: [
        ...Array.from({ length: setup.primary ?? 1 }, (_, index) => ({ coachId: `lead-${index}`, isPrimary: true })),
        ...assistants,
      ],
    } },
    room: { findUnique: async () => setup.noRoom ? null : ({
      facilityId: setup.otherFacility ? "facility-b" : "facility-a", isActive: !setup.roomInactive,
      capacity: setup.capacity ?? 15, areaType: setup.area ?? "INDOOR",
      capabilities: [{ key: "mats", quantity: setup.equipment ?? 3 }],
    }) },
    coachProfile: { findUnique: async ({ where }: { where: { id: string } }) => {
      reads.push(where.id);
      return setup.coachError === "missing" ? null : {
        userId: where.id, user: { isActive: setup.coachError !== "inactive" },
        specializations: setup.coachError === "unspecialized" ? [] : [{ sportId: "sport" }],
      };
    } },
    facilityStaff: { findFirst: async ({ where }: { where: { facilityId: string; role: string; isActive: boolean } }) => {
      assert.deepEqual([where.facilityId, where.role, where.isActive], ["facility-a", "COACH", true]);
      return setup.coachError === "unassigned" ? null : { id: "assignment" };
    } },
    leaveRequest: { findFirst: async ({ where }: any) => {
      assert.equal(where.status, "APPROVED");
      assert.equal(where.OR.length, setup.batch ? 2 : 1);
      const leave = setup.leave;
      return leave && where.OR.some(({ startTime, endTime }: any) =>
        at(leave[0] * MINUTE) < startTime.lt && at(leave[1] * MINUTE) > endTime.gt) ? { id: "leave" } : null;
    } },
  };
  const first = { startTime: at(0), endTime: at(60 * MINUTE) };
  const result = validateResources(db, "room", "class", first.startTime, first.endTime, setup.replacement,
    setup.batch ? [first, { startTime: at(110 * MINUTE), endTime: at(160 * MINUTE) }] : undefined);
  if (error) await assert.rejects(result, error.includes(" ") ? new RegExp(error) : { message: new RegExp(error) });
  else {
    await result;
    if (setup.replacement) assert.deepEqual(reads.sort(), ["assistant", "substitute"]);
  }
});

cases("BR-SCHED-PATTERN", [
  ["thứ Hai 07h ICT không lệch sang ngày khác", "2032-03-15", "2032-03-15", [1], 420, 480, ["2032-03-15T00:00:00.000Z"]],
  ["thứ Hai 00h ICT tương ứng tối chủ nhật UTC", "2032-03-15", "2032-03-15", [1], 0, 60, ["2032-03-14T17:00:00.000Z"]],
  ["giữ đúng hai ngày thứ Hai liên tiếp", "2032-03-15", "2032-03-22", [1], 420, 480, ["2032-03-15T00:00:00.000Z", "2032-03-22T00:00:00.000Z"]],
  ["lựa chọn nhiều thứ không bỏ buổi cuối", "2032-03-15", "2032-03-17", [1, 3], 420, 480, ["2032-03-15T00:00:00.000Z", "2032-03-17T00:00:00.000Z"]],
  ["không sinh lịch với ngày không tồn tại", "2032-02-30", "2032-03-15", [1], 420, 480, null],
  ["không sinh lịch nếu kết thúc trước bắt đầu", "2032-03-20", "2032-03-15", [1], 420, 480, null],
  ["chặn dải ngày mở rộng quá một năm", "2032-03-15", "2033-03-25", [1], 420, 480, null],
  ["không chấp nhận giờ kết thúc bằng giờ bắt đầu", "2032-03-15", "2032-03-15", [1], 420, 420, null],
  ["không chấp nhận giờ vượt 24h", "2032-03-15", "2032-03-15", [1], 420, 1441, null],
  ["không chấp nhận thứ ngoài thứ Hai đến Chủ nhật", "2032-03-15", "2032-03-15", [8], 420, 480, null],
  ["báo lỗi nếu dải ngày không có thứ được chọn", "2032-03-15", "2032-03-15", [7], 420, 480, null],
] as const, ([, start, end, weekdays, from, to, expected]) => {
  const expand = () => expandPattern(start, end, [...weekdays], from, to);
  if (expected === null) assert.throws(expand, /Invalid schedule pattern|Pattern produces no sessions/);
  else {
    const schedule = expand();
    assert.deepEqual(schedule.map(row => row.startTime.toISOString()), expected);
    assert.ok(schedule.every(row => +row.endTime - +row.startTime === (to - from) * MINUTE));
  }
});

const lead = { coachId: "lead", isPrimary: true };
const assistant = { coachId: "assistant", isPrimary: false };
cases("BR-SCHED-COACH", [
  ["phân công chuẩn dùng cả HLV chính và hỗ trợ", null, [lead, assistant], ["lead", "assistant"]],
  ["HLV thay ca thay HLV chính trong một buổi", "substitute", [lead, assistant], ["assistant", "substitute"]],
  ["HLV hỗ trợ kiêm thay ca chỉ xuất hiện một lần", "assistant", [lead, assistant], ["assistant"]],
  ["HLV thay ca có thể dạy buổi dù lớp chưa có HLV cố định", "substitute", [], ["substitute"]],
] as const, ([, coachId, coaches, expected]) => {
  assert.deepEqual(effectiveCoachIds({ coachId, class: { coaches: [...coaches] } }), expected);
});

const semester = {
  id: "term-a", name: "Học kỳ", status: "PLANNING" as const,
  startDate: at(2 * DAY), endDate: at(10 * DAY),
  registrationStartDate: at(0), registrationEndDate: at(DAY),
};
cases("BR-TERM-WINDOW", [
  ["trước giờ mở một mili giây còn ở kế hoạch", -1, null, "PLANNING", "TERM_REGISTRATION_NOT_STARTED"],
  ["đúng thời điểm mở có thể đăng ký", 0, null, "OPEN_REGISTRATION", null],
  ["đúng thời điểm đóng vẫn có thể đăng ký", DAY, null, "OPEN_REGISTRATION", null],
  ["quá giờ đóng một mili giây chặn đăng ký", DAY + 1, null, "PLANNING", "TERM_REGISTRATION_CLOSED"],
  ["đến ngày bắt đầu chuyển sang đang học", 2 * DAY, null, "IN_PROGRESS", "TERM_REGISTRATION_CLOSED"],
  ["ngày cuối còn đang học nhưng đã đóng đăng ký", 10 * DAY, null, "IN_PROGRESS", "TERM_REGISTRATION_CLOSED"],
  ["quá ngày cuối chuyển sang đã kết thúc", 10 * DAY + 1, null, "CLOSED", "TERM_REGISTRATION_CLOSED"],
  ["đóng thủ công ưu tiên hơn khung đăng ký", 1, "CLOSED", "CLOSED", "TERM_CLOSED"],
] as const, ([, offset, forced, status, blocker]) => {
  const current = { ...semester, status: forced ?? semester.status };
  assert.equal(withTermStatus(current, at(offset)).status, status);
  assert.equal(termRegistrationBlocker(current, at(offset))?.code ?? null, blocker);
});

const draft = { code: "HK01", name: "Học kỳ mới", startDate: at(2 * DAY).toISOString(),
  endDate: at(10 * DAY).toISOString(), registrationStartDate: at(0).toISOString(), registrationEndDate: at(DAY).toISOString() };
schemaCases("BR-TERM-CONTRACT", CreateTermSchema, [
  ["cửa đăng ký trước ngày học hợp lệ", draft, true],
  ["không đóng đăng ký sau ngày kết thúc kỳ", { ...draft, registrationEndDate: at(11 * DAY).toISOString() }, false, "registrationEndDate"],
  ["không dùng cùng mốc mở và đóng đăng ký", { ...draft, registrationEndDate: draft.registrationStartDate }, false, "registrationEndDate"],
  ["không dùng cùng mốc bắt đầu và kết thúc học kỳ", { ...draft, endDate: draft.startDate }, false, "endDate"],
  ["không nhận trạng thái không có trong quy trình", { ...draft, status: "ACTIVE" }, false, "status"],
]);
