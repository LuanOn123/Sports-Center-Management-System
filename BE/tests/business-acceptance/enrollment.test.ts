import { at, cases, DAY, MINUTE, NOW, schemaCases } from "./support.js";
import assert from "node:assert/strict";
import { requestContext } from "../../src/config/request-context.js";
import { getScheduleTravelConflictReason } from "../../src/modules/enrollments/enrollments.service.js";
import { evaluateCourseEligibility } from "../../src/modules/enrollments/course-enrollment.service.js";
import { EnrollWholeCourseSchema, TransferEnrollmentSchema } from "../../src/modules/enrollments/enrollments.schema.js";
import { assertConcurrentClassQuota } from "../../src/modules/enrollments/enrollment-quota.service.js";
import { createTermMembershipGrant, termMembershipCovers } from "../../src/modules/enrollments/term-membership-policy.js";

const active = { id: "subscription-a", tier: "MEMBERSHIP", status: "ACTIVE", startDate: at(-20 * DAY), endDate: at(20 * DAY) };
const term = {
  id: "term-a", name: "Học kỳ", status: "PLANNING" as const,
  startDate: at(DAY), endDate: at(60 * DAY),
  registrationStartDate: at(-DAY), registrationEndDate: at(DAY),
};
const trainingScope = { memberId: "member-a", classId: "class-a", termId: term.id };

cases("BR-ENR-GRANT", [
  ["đúng 50 phần trăm thời hạn cấp quyền", {}, 0, 60 * DAY, true],
  ["trên 50 phần trăm đúng một mili giây cấp quyền", {}, -1, 60 * DAY, true],
  ["dưới 50 phần trăm đúng một mili giây không cấp quyền", {}, 1, 60 * DAY, false],
  ["ngày đầu gói đã bắt đầu có thể cấp quyền", {}, -20 * DAY, 60 * DAY, true],
  ["trước ngày hiệu lực không cấp quyền", {}, -20 * DAY - 1, 60 * DAY, false],
  ["tại ngày hết hạn không cấp quyền mới", {}, 20 * DAY, 60 * DAY, false],
  ["gói đã hủy không sinh ngoại lệ", { status: "CANCELLED" }, 0, 60 * DAY, false],
  ["gói bị thay thế không sinh ngoại lệ", { status: "SUSPENDED" }, 0, 60 * DAY, false],
  ["gói chưa kích hoạt không sinh ngoại lệ", { status: "SCHEDULED" }, 0, 60 * DAY, false],
  ["kỳ kết thúc tại ngày duyệt không sinh ngoại lệ", {}, 0, 0, false],
  ["kỳ hết hạn không sinh ngoại lệ", {}, 0, -1, false],
] as const, ([, patch, approval, termEnd, eligible]) => {
  const grant = createTermMembershipGrant({ ...active, ...patch }, { ...term, endDate: at(termEnd) }, "member-a", "class-a", at(approval));
  assert.equal(!!grant, eligible);
  if (grant) assert.deepEqual(
    [grant.memberId, grant.classId, grant.termId, grant.subscriptionId, grant.approvedAt, grant.validUntil],
    ["member-a", "class-a", "term-a", "subscription-a", at(approval).toISOString(), at(termEnd).toISOString()],
  );
});

const validGrant = createTermMembershipGrant(active, term, "member-a", "class-a", NOW);
const normalSession = { ...trainingScope, startTime: at(30 * DAY), endTime: at(30 * DAY + 60 * MINUTE) };
cases("BR-ENR-GRANT-SCOPE", [
  ["quyền dùng được sau khi gói hết hạn tự nhiên", normalSession, true],
  ["không chuyển quyền cho người khác", { ...normalSession, memberId: "member-b" }, false],
  ["không chuyển quyền sang lớp khác", { ...normalSession, classId: "class-b" }, false],
  ["không chuyển quyền sang kỳ khác", { ...normalSession, termId: "term-b" }, false],
  ["buổi không có kỳ không nhận ngoại lệ", { ...normalSession, termId: null }, false],
  ["buổi có ngày bắt đầu trước thời điểm phê duyệt bị chặn", { ...normalSession, startTime: at(-1) }, false],
  ["buổi kết thúc đúng mốc kỳ vẫn có quyền", { ...normalSession, endTime: term.endDate }, true],
  ["buổi vượt hạn kỳ một mili giây không có quyền", { ...normalSession, endTime: at(60 * DAY + 1) }, false],
  ["buổi dài 0 phút không thuộc quyền", { ...normalSession, endTime: normalSession.startTime }, false],
] as const, ([, target, expected]) => assert.equal(termMembershipCovers(validGrant, target), expected));

const center = { startTime: at(0), endTime: at(60 * MINUTE), facilityId: "facility-a" };
cases("BR-ENR-TRAVEL", [
  ["khác cơ sở nối đuôi phía trước thiếu thời gian", -60, 0, "facility-b", 30, true],
  ["khác cơ sở nối đuôi phía sau thiếu thời gian", 60, 120, "facility-b", 30, true],
  ["khác cơ sở còn 29 phút từ lịch trước bị chặn", -60, -29, "facility-b", 30, true],
  ["khác cơ sở lịch trước cách đúng 30 phút hợp lệ", -60, -30, "facility-b", 30, false],
  ["khác cơ sở còn 29 phút đến lịch sau bị chặn", 89, 130, "facility-b", 30, true],
  ["khác cơ sở lịch sau cách đúng 30 phút hợp lệ", 90, 130, "facility-b", 30, false],
  ["lịch cùng cơ sở nối đuôi không cần buffer", 60, 120, "facility-a", 30, false],
  ["lịch chưa xác định cơ sở không tự đặt luật di chuyển", 60, 120, null, 30, false],
  ["tắt buffer cho phép nối đuôi giữa cơ sở", 60, 120, "facility-b", 0, false],
  ["dùng ngưỡng tùy cấu hình thay vì luôn 30 phút", 95, 130, "facility-b", 45, true],
  ["giáp mốc dưới một phút vẫn bị chặn với buffer 1", 60.5, 130, "facility-b", 1, true],
] as const, ([, start, end, facilityId, buffer, conflict]) => {
  const result = getScheduleTravelConflictReason(center, [{
    startTime: at(start * MINUTE), endTime: at(end * MINUTE), facilityId,
    className: "Lớp đã đặt", scheduleId: "booked-slot",
  }], buffer);
  assert.equal(!!result, conflict);
  if (result) assert.equal(result.scheduleId, "booked-slot");
});

function booked(ids: readonly string[]) {
  return ids.map((classId, index) => ({
    id: `booking-${index}`, classId,
    schedule: { id: `slot-${index}`, startTime: at(DAY + index * MINUTE), class: { name: classId } },
  }));
}
type QuotaCase = readonly [string, string | null, number | null, number, readonly string[], string, boolean, number, number];
cases<QuotaCase>("BR-ENR-QUOTA", [
  ["FREE không giữ được lớp trả phí", "FREE", 0, 0, [], "yoga", false, 0, 0],
  ["không có gói hiệu lực khác với FREE", null, null, 3, [], "yoga", false, 0, 0],
  ["Standard thêm lớp đầu tiên", "MEMBERSHIP", 3, 3, [], "yoga", true, 0, 3],
  ["Standard thêm lớp thứ ba", "MEMBERSHIP", 3, 3, ["a", "b"], "c", true, 2, 3],
  ["Standard không thêm lớp thứ tư", "MEMBERSHIP", 3, 3, ["a", "b", "c"], "d", false, 3, 3],
  ["đặt thêm buổi trong lớp đã giữ khi quota đầy", "MEMBERSHIP", 3, 3, ["a", "b", "c"], "a", true, 3, 3],
  ["nhiều buổi một lớp chỉ tiêu một quota", "MEMBERSHIP", 3, 3, ["a", "a", "a"], "b", true, 1, 3],
  ["Premium thêm lớp thứ sáu", "PREMIUM", 6, 6, ["a", "b", "c", "d", "e"], "f", true, 5, 6],
  ["Premium không thêm lớp thứ bảy", "PREMIUM", 6, 6, ["a", "b", "c", "d", "e", "f"], "g", false, 6, 6],
  ["catalog tăng quota không đổi quota đã bán", "MEMBERSHIP", 1, 9, ["a"], "b", false, 1, 1],
  ["catalog giảm quota không tước quota đã bán", "MEMBERSHIP", 4, 1, ["a"], "b", true, 1, 4],
  ["gói cũ chưa có snapshot dùng quota catalog", "MEMBERSHIP", null, 2, ["a"], "b", true, 1, 2],
  ["quota snapshot bằng 0 được giữ nguyên", "MEMBERSHIP", 0, 3, [], "b", false, 0, 0],
] as const, async ([, tier, snapshot, live, held, target, allowed, used, limit]) => {
  const db = {
    membershipSubscription: { findFirst: async ({ where }: any) => {
      assert.equal(where.memberId, "member-a");
      return where.status === "ACTIVE" && tier ? { ...active, tier, maxConcurrentClassesSnapshot: snapshot, plan: { maxConcurrentClasses: live } } : null;
    } },
    enrollment: { findMany: async ({ where }: any) => {
      assert.equal(requestContext.getStore()?.facilityId, undefined, "quota must read every facility");
      assert.deepEqual(where, { memberId: "member-a", status: "BOOKED", schedule: { status: "SCHEDULED", startTime: { gt: NOW } } });
      return booked(held);
    } },
  } as unknown as Parameters<typeof assertConcurrentClassQuota>[0];
  const result = requestContext.run({ facilityId: "facility-a" }, () => assertConcurrentClassQuota(db, "member-a", target, { now: NOW }));
  if (allowed) {
    const quota = await result;
    assert.deepEqual([quota.used, quota.limit, quota.remaining], [used, limit, Math.max(0, limit - used)]);
  } else await assert.rejects(result, { statusCode: 403, errors: {
    code: "CONCURRENT_CLASS_LIMIT_REACHED", tier, limit, used, remaining: Math.max(0, limit - used),
  } });
});

const course = { id: "class-a", name: "Khóa Yoga", capacity: 10, classType: "REGULAR", facilityId: "facility-a" };
const slots = [7, 14].map((day, index) => ({
  id: `course-${index}`, roomId: "room-a", room: { id: "room-a", name: "Phòng A" },
  startTime: at(day * DAY), endTime: at(day * DAY + 60 * MINUTE),
}));
type CourseSetup = {
  noPlan?: boolean; premium?: boolean; hasPremium?: boolean; starts?: number; expires?: number; termState?: "CLOSED" | "BEFORE" | "AFTER" | "OPEN";
  full?: number; held?: boolean; penalty?: boolean; occupancy?: number; noSessions?: boolean; overlaps?: boolean;
};
cases<readonly [string, CourseSetup, readonly string[]]>("BR-ENR-COURSE", [
  ["gói đủ thời hạn và còn chỗ cho phép cả khóa", {}, []],
  ["khóa chưa xếp lịch không cho đăng ký", { noSessions: true }, ["NO_UPCOMING_SESSION"]],
  ["thiếu gói đang hiệu lực không cho đăng ký", { noPlan: true }, ["NO_ACTIVE_SUBSCRIPTION"]],
  ["lớp Premium từ chối gói Standard", { premium: true }, ["PREMIUM_REQUIRED"]],
  ["lớp Premium nhận Premium đủ hạn", { premium: true, hasPremium: true }, []],
  ["gói hết hạn ngay sau buổi cuối vẫn đủ", { expires: 14 * DAY + 60 * MINUTE }, []],
  ["gói hết hạn trước cuối khóa 1 ms thì thiếu quyền", { expires: 14 * DAY + 60 * MINUTE - 1 }, ["SUBSCRIPTION_ENDS_BEFORE_COURSE_END"]],
  ["gói còn đúng một nửa được đăng ký vượt hạn gói trong kỳ mở", { termState: "OPEN", starts: -8 * DAY, expires: 8 * DAY }, []],
  ["kỳ chưa mở chặn cả khóa", { termState: "BEFORE" }, ["TERM_REGISTRATION_NOT_STARTED"]],
  ["kỳ hết cửa đăng ký chặn cả khóa", { termState: "AFTER" }, ["TERM_REGISTRATION_CLOSED"]],
  ["kỳ đóng thủ công chặn dù ngày đăng ký hợp lệ", { termState: "CLOSED" }, ["TERM_CLOSED"]],
  ["hết chỗ chỉ ở buổi cuối vẫn chặn cả khóa", { full: 1 }, ["SESSION_FULL"]],
  ["buổi đã giữ chỗ không phát sinh chặn hết chỗ cho người sở hữu", { full: 0, held: true }, []],
  ["cảnh cáo đã thành chế tài chặn đăng ký", { penalty: true }, ["ATTENDANCE_PENALTY_ACTIVE"]],
  ["báo đủ nguyên nhân Premium và buổi hết chỗ", { premium: true, full: 1 }, ["PREMIUM_REQUIRED", "SESSION_FULL"]],
  ["gói đã giữ đủ ba lớp không đăng ký khóa thứ tư", { occupancy: 3 }, ["CONCURRENT_CLASS_LIMIT_REACHED"]],
  ["hai buổi trong chính khóa chồng lịch không thể đăng ký", { overlaps: true }, ["TIME_CONFLICT", "TIME_CONFLICT"]],
], async ([, setup, expected]) => {
  const sub = { ...active, tier: setup.hasPremium ? "PREMIUM" : "MEMBERSHIP",
    startDate: setup.starts === undefined ? active.startDate : at(setup.starts),
    endDate: setup.expires === undefined ? at(20 * DAY) : at(setup.expires),
    maxConcurrentClassesSnapshot: 3, plan: { maxConcurrentClasses: 3, name: "Gói" } };
  const semester = { ...term, status: setup.termState === "CLOSED" ? "CLOSED" : "PLANNING",
    registrationStartDate: setup.termState === "BEFORE" ? at(1) : term.registrationStartDate,
    registrationEndDate: setup.termState === "AFTER" ? at(-1) : term.registrationEndDate };
  const sessions = setup.overlaps ? [slots[0], { ...slots[1], startTime: at(7 * DAY + 20 * MINUTE), endTime: at(7 * DAY + 70 * MINUTE) }] : slots;
  const db = {
    membershipSubscription: { findFirst: async ({ where }: any) => where.status === "ACTIVE" && !setup.noPlan ? sub : null },
    enrollment: {
      groupBy: async () => setup.full === undefined ? [] : [{ scheduleId: slots[setup.full].id, _count: { _all: 10 } }],
      findMany: async ({ select }: any) => select.termMembershipGrant
        ? (setup.held ? [{ id: "held", scheduleId: slots[0].id, status: "BOOKED", termMembershipGrant: null }] : [])
        : select.id ? booked(Array.from({ length: setup.occupancy ?? 0 }, (_, index) => `other-${index}`)) : [],
    },
    attendancePenalty: { findFirst: async () => setup.penalty ? { id: "penalty", attendanceRate: 10, sampleSize: 8, blockedUntil: at(DAY) } : null },
    classSchedule: { findMany: async () => setup.termState ? sessions.map(({ id }) => ({ id, term: semester })) : [] },
    facility: { findUnique: async () => ({ maxMembers: null }) },
    issue: { findMany: async () => [] },
  } as unknown as Parameters<typeof evaluateCourseEligibility>[0];
  const result = await evaluateCourseEligibility(db, "member-a", {
    ...course, classType: setup.premium ? "PREMIUM" : "REGULAR",
  }, setup.noSessions ? [] : sessions, { now: NOW });
  assert.deepEqual(result.blockers.map(blocker => blocker.code).sort(), [...expected].sort());
  if (setup.starts !== undefined) assert.equal(result.termMembershipGrant?.validUntil, term.endDate.toISOString());
  if (setup.full === 1) assert.ok(result.blockers.some(blocker => blocker.code === "SESSION_FULL" && blocker.sessionId === slots[1].id));
});

schemaCases("BR-ENR-INPUT", EnrollWholeCourseSchema, [
  ["khóa có thể nhận mục tiêu và ghi chú sức khỏe hợp lệ", { classId: "class-a", goal: "Bơi 25 mét", healthNotes: "Ghi chú", saveToProfile: true }, true],
  ["không thể tạo khóa đăng ký khi thiếu mã lớp", { goal: "Bơi 25 mét" }, false, "classId"],
  ["từ chối ghi chú sức khỏe quá dài", { classId: "class-a", healthNotes: "x".repeat(1001) }, false, "healthNotes"],
  ["từ chối mục tiêu quá dài", { classId: "class-a", goal: "x".repeat(501) }, false, "goal"],
]);
schemaCases("BR-ENR-TRANSFER", TransferEnrollmentSchema, [
  ["đổi buổi cần một buổi đích", { targetScheduleId: "new-slot" }, true],
  ["đổi buổi thiếu mã đích bị từ chối", {}, false, "targetScheduleId"],
]);
