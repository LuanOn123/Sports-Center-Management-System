import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import {
  ATTENDANCE,
  absenceAllowance,
  classifyAttendance,
  classifyFixedAbsence,
  isSystemNoShow,
  type AttendanceBucketStatus,
  type AttendancePolicyKind,
} from "../../config/attendance.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

/** A10: khoảng thời gian member thực sự có quyền lợi (dùng cho analytics + kiểm tra dời lịch A11). */
export type MembershipCoverageInterval = { from: Date; to: Date };

/**
 * A10 — Dựng khoảng quyền lợi từ danh sách subscription (mọi trạng thái):
 * - to = min(endDate, cancelledAt) — hủy sớm thì quyền lợi dừng ở mốc hủy.
 * - FINAL: gói SUSPENDED = gói cũ bị thay thế tại suspendedAt — quyền lợi dừng ở
 *   mốc thay thế, KHÔNG phải bảo lưu/freeze (Freeze đã loại khỏi scope).
 * Trạng thái hiện tại không bao giờ xóa lịch sử đã học trước đó.
 */
export function buildCoverageIntervals(
  subs: Array<{
    startDate: Date;
    endDate: Date;
    status: string;
    suspendedAt?: Date | null;
    cancelledAt?: Date | null;
  }>
): MembershipCoverageInterval[] {
  return subs.map((sub) => {
    let to = sub.endDate;
    if (sub.cancelledAt && sub.cancelledAt < to) to = sub.cancelledAt;
    if (sub.status === "SUSPENDED" && sub.suspendedAt && sub.suspendedAt < to) to = sub.suspendedAt;
    return { from: sub.startDate, to };
  });
}

/** Thời điểm `at` có nằm trong ít nhất một khoảng quyền lợi (bao gồm cả biên). */
export function isCoveredAt(intervals: MembershipCoverageInterval[], at: Date): boolean {
  return intervals.some((iv) => iv.from <= at && at <= iv.to);
}

/** A10 — Khoảng quyền lợi của nhiều member (1 query) — dùng lại ở A11 khi dời lịch. */
export async function getMembershipCoverageIntervals(
  db: DbClient,
  memberIds: string[]
): Promise<Map<string, MembershipCoverageInterval[]>> {
  if (memberIds.length === 0) return new Map();
  const subs = await db.membershipSubscription.findMany({
    where: { memberId: { in: memberIds } },
    select: {
      memberId: true,
      status: true,
      startDate: true,
      endDate: true,
      suspendedAt: true,
      cancelledAt: true,
    },
  });
  const map = new Map<string, MembershipCoverageInterval[]>();
  for (const sub of subs) {
    map.set(sub.memberId, [...(map.get(sub.memberId) ?? []), ...buildCoverageIntervals([sub])]);
  }
  return map;
}

export type AttendanceBucket = {
  memberId: string;
  memberName: string;
  memberUserId: string;
  classId: string;
  className: string;
  sampleSize: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  noShowCount: number;
  excusedCount: number;
  attendanceRate: number;
  status: AttendanceBucketStatus;
  /** FIXED: lớp có tổng số buổi kế hoạch hữu hạn; RECURRING: fallback rolling. */
  policy: AttendancePolicyKind;
  /** FIXED: tổng số buổi kế hoạch của Class (mọi trạng thái, trừ CANCELLED của trung tâm). */
  totalPlannedSessions: number | null;
  /** FIXED: số buổi đã chốt kết quả (đã kết thúc + trong coverage). */
  completedSessions: number;
  /** FIXED: ABSENT + NO_SHOW đã chốt (EXCUSED/cancelled/tương lai/chưa chốt loại). */
  currentAbsences: number;
  /** FIXED: floor(total × 20%). */
  allowedAbsences: number;
  /** FIXED: max(allowed − current, 0); WARNING → 0. */
  remainingAbsences: number;
};

/**
 * Chỉ số chuyên cần theo (memberId × classId) — KHÔNG theo schedule.
 * Nhờ vậy member đổi buổi trong cùng Class (transfer) không reset lịch sử.
 *
 * Hai chính sách (phân biệt bằng snapshot Class, KHÔNG suy từ COUNT schedule):
 * - FIXED: Class.attendancePolicy = "FIXED" VÀ plannedSessionCount > 0.
 *   allowance = floor(plannedSessionCount × 20%); currentAbsences = ABSENT + NO_SHOW đã chốt;
 *   < allowance -> NORMAL; == allowance -> NOTICE; > allowance -> WARNING.
 *   Đánh giá sớm sau mỗi buổi chốt, KHÔNG chờ học hết khóa, KHÔNG yêu cầu mẫu 5.
 *   Thêm schedule sau này KHÔNG làm tăng plannedSessionCount.
 * - RECURRING: mọi trường hợp còn lại — fallback rolling tối đa SAMPLE_WINDOW buổi gần nhất.
 *
 * Loại trừ chung (cả hai chính sách):
 * - schedule CANCELLED (trung tâm hủy)
 * - schedule chưa kết thúc / chưa chốt kết quả
 * - schedule nằm NGOÀI khoảng quyền lợi thực tế của member (A10).
 *
 * A10 — quyền lợi tính theo LỊCH SỬ, không theo trạng thái hiện tại của gói.
 *
 * rate = (PRESENT + LATE) / (PRESENT + LATE + ABSENT + NO_SHOW); EXCUSED không vào tử/mẫu.
 * ABSENT do hệ thống tự tạo (note = SYSTEM_NO_SHOW) được đếm riêng là noShow.
 */
export async function computeAttendanceBuckets(
  db: DbClient,
  options: { memberId?: string; classId?: string; now?: Date } = {}
): Promise<AttendanceBucket[]> {
  const now = options.now ?? new Date();

  const enrollments = await db.enrollment.findMany({
    where: {
      status: { in: ["BOOKED", "COMPLETED"] },
      ...(options.memberId ? { memberId: options.memberId } : {}),
      ...(options.classId ? { classId: options.classId } : {}),
      schedule: { status: { not: "CANCELLED" }, endTime: { lte: now } },
    },
    select: {
      memberId: true,
      classId: true,
      schedule: { select: { id: true, startTime: true } },
    },
    orderBy: { schedule: { startTime: "desc" } },
  });
  if (enrollments.length === 0) return [];

  // FINAL: đọc snapshot Class.attendancePolicy/plannedSessionCount.
  // FIXED = policy FIXED và plannedSessionCount > 0 (con số cố định, không COUNT schedule).
  // Thêm schedule sau này KHÔNG làm tăng snapshot → allowance không tự đổi ngược.
  const classIdsForPolicy = [...new Set(enrollments.map((e) => e.classId))];
  const policyRows = await db.class.findMany({
    where: { id: { in: classIdsForPolicy } },
    select: { id: true, attendancePolicy: true, plannedSessionCount: true },
  });
  const policyByClass = new Map(
    policyRows.map((c) => [
      c.id,
      {
        isFixed:
          c.attendancePolicy === "FIXED" &&
          typeof c.plannedSessionCount === "number" &&
          c.plannedSessionCount > 0,
        total: c.plannedSessionCount ?? 0,
      },
    ]),
  );

  // Gom theo (member × class). RECURRING giữ tối đa SAMPLE_WINDOW buổi gần nhất;
  // FIXED giữ TOÀN BỘ buổi đã chốt trong coverage (không cắt rolling).
  const grouped = new Map<
    string,
    { memberId: string; classId: string; schedules: { id: string; startTime: Date }[] }
  >();
  for (const e of enrollments) {
    const key = `${e.memberId}|${e.classId}`;
    const entry = grouped.get(key) ?? { memberId: e.memberId, classId: e.classId, schedules: [] };
    const isFixed = policyByClass.get(e.classId)?.isFixed ?? false;
    // FIXED: giữ toàn bộ để currentAbsences phản ánh cả khóa.
    // RECURRING: fallback rolling 10.
    if (isFixed || entry.schedules.length < ATTENDANCE.SAMPLE_WINDOW) entry.schedules.push(e.schedule);
    grouped.set(key, entry);
  }

  const memberIds = [...new Set([...grouped.values()].map((g) => g.memberId))];
  const classIds = [...new Set([...grouped.values()].map((g) => g.classId))];
  const scheduleIds = [...new Set([...grouped.values()].flatMap((g) => g.schedules.map((s) => s.id)))];

  const [members, classes, subscriptions, attendances] = await Promise.all([
    db.memberProfile.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, user: { select: { id: true, fullName: true } } },
    }),
    db.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }),
    db.membershipSubscription.findMany({
      where: { memberId: { in: memberIds } },
      select: {
        memberId: true,
        status: true,
        startDate: true,
        endDate: true,
        suspendedAt: true,
        cancelledAt: true,
      },
    }),
    db.attendance.findMany({
      where: { memberId: { in: memberIds }, scheduleId: { in: scheduleIds } },
      select: { memberId: true, scheduleId: true, status: true, note: true },
    }),
  ]);

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const coverageByMember = new Map<string, MembershipCoverageInterval[]>();
  for (const sub of subscriptions) {
    coverageByMember.set(sub.memberId, [
      ...(coverageByMember.get(sub.memberId) ?? []),
      ...buildCoverageIntervals([sub]),
    ]);
  }
  const attendanceMap = new Map(attendances.map((a) => [`${a.memberId}|${a.scheduleId}`, a]));

  /** Buổi chỉ được tính khi thời điểm học nằm trong khoảng quyền lợi LỊCH SỬ (A10). */
  const isCoveredByMembership = (memberId: string, at: Date) =>
    isCoveredAt(coverageByMember.get(memberId) ?? [], at);

  const buckets: AttendanceBucket[] = [];
  for (const entry of grouped.values()) {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let noShowCount = 0;
    let excusedCount = 0;

    for (const schedule of entry.schedules) {
      if (!isCoveredByMembership(entry.memberId, schedule.startTime)) continue;
      const attendance = attendanceMap.get(`${entry.memberId}|${schedule.id}`);
      if (!attendance) {
        noShowCount++; // buổi đã kết thúc nhưng chưa có bản ghi điểm danh
        continue;
      }
      if (attendance.status === "PRESENT") presentCount++;
      else if (attendance.status === "LATE") lateCount++;
      else if (attendance.status === "EXCUSED") excusedCount++;
      else if (isSystemNoShow(attendance.note)) noShowCount++;
      else absentCount++;
    }

    const sampleSize = presentCount + lateCount + absentCount + noShowCount;
    const attendanceRate =
      sampleSize === 0 ? 100 : Math.round(((presentCount + lateCount) / sampleSize) * 1000) / 10;

    // FINAL: tổng kế hoạch là snapshot Class.plannedSessionCount (không COUNT schedule).
    // completedSessions = số buổi đã chốt kết quả trong coverage (tử + mẫu + EXCUSED).
    // currentAbsences = ABSENT + NO_SHOW đã chốt; allowance = floor(snapshot × 20%).
    const policy = policyByClass.get(entry.classId);
    const totalPlanned = policy?.total ?? 0;
    const completedSessions = sampleSize + excusedCount;
    const currentAbsences = absentCount + noShowCount;
    const isFixed = policy?.isFixed ?? false;
    const allowedAbsences = isFixed ? absenceAllowance(totalPlanned) : 0;
    const remainingAbsences = isFixed ? Math.max(allowedAbsences - currentAbsences, 0) : 0;

    buckets.push({
      memberId: entry.memberId,
      memberName: memberMap.get(entry.memberId)?.user.fullName ?? "Hội viên",
      memberUserId: memberMap.get(entry.memberId)?.user.id ?? "",
      classId: entry.classId,
      className: classMap.get(entry.classId)?.name ?? "Lớp học",
      sampleSize,
      presentCount,
      lateCount,
      absentCount,
      noShowCount,
      excusedCount,
      attendanceRate,
      status: isFixed
        ? classifyFixedAbsence(currentAbsences, allowedAbsences)
        : classifyAttendance(attendanceRate, sampleSize),
      policy: isFixed ? "FIXED" : "RECURRING",
      totalPlannedSessions: isFixed ? totalPlanned : null,
      completedSessions,
      currentAbsences,
      allowedAbsences,
      remainingAbsences,
    });
  }

  return buckets;
}

/** Câu giải thích cho Manager: FIXED nêu allowance, RECURRING nêu ngưỡng rolling. */
export function buildPenaltyReason(bucket: AttendanceBucket): string {
  if (bucket.policy === "FIXED" && bucket.totalPlannedSessions != null) {
    return (
      `Chuyên cần ${bucket.attendanceRate}% (khóa ${bucket.totalPlannedSessions} buổi: ` +
      `${bucket.presentCount} có mặt, ${bucket.lateCount} đi muộn, ${bucket.absentCount} vắng, ` +
      `${bucket.noShowCount} không điểm danh; đã vắng ${bucket.currentAbsences}/${bucket.allowedAbsences} buổi cho phép). ` +
      `Hãy review thủ công trước khi phạt.`
    );
  }
  return (
    `Chuyên cần ${bucket.attendanceRate}% (${bucket.sampleSize} buổi được tính: ` +
    `${bucket.presentCount} có mặt, ${bucket.lateCount} đi muộn, ${bucket.absentCount} vắng, ` +
    `${bucket.noShowCount} không điểm danh) — dưới ngưỡng ${ATTENDANCE.RELEASE_THRESHOLD}%.`
  );
}
