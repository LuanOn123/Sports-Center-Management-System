import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { getStaffFacilityId } from "../../middlewares/facilityScope.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { lockMemberClass, lockMemberQuota } from "../../utils/dbLocks.js";
import {
  getMembershipCoverageIntervals,
  isCoveredAt,
} from "./attendance-analytics.service.js";
import { createNotification } from "../notifications/notifications.service.js";

function checked<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      "Dữ liệu chuyên cần không hợp lệ",
      400,
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  return result.data;
}
type Staff = { id: string; role: string };
export const attendancePairSchema = z.object({
  memberId: z.string().min(1),
  classId: z.string().min(1),
});
export const attendanceReportSchema = attendancePairSchema.extend({
  reason: z.string().trim().min(5).max(1000),
});
export const attendanceReviewSchema = z.object({
  decision: z.enum(["APPROVE_REMOVAL", "REJECT"]),
  response: z.string().trim().min(5).max(1000),
});
export const monitoringQuerySchema = z.object({
  memberId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["NORMAL", "WARNING", "VIOLATION"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReceptionAttendanceStatus = "NORMAL" | "WARNING" | "VIOLATION";
export function classifyReceptionAttendance(
  absenceRate: number,
): ReceptionAttendanceStatus {
  return absenceRate >= 30
    ? "VIOLATION"
    : absenceRate >= 20
      ? "WARNING"
      : "NORMAL";
}
export function attendanceSummary(sessions: { state: string }[]) {
  const totalRelevantClassSessions = sessions.filter(
    (s) => s.state !== "EXCUSED",
  ).length;
  const count = (state: string) =>
    sessions.filter((s) => s.state === state).length;
  const attendedCount = count("PRESENT") + count("LATE");
  const absentCount = count("ABSENT");
  // Classify using integer products, before rounding the presentation value.
  const status: ReceptionAttendanceStatus = !totalRelevantClassSessions
    ? "NORMAL"
    : absentCount * 100 >= totalRelevantClassSessions * 30
      ? "VIOLATION"
      : absentCount * 100 >= totalRelevantClassSessions * 20
        ? "WARNING"
        : "NORMAL";
  return {
    attendedCount,
    absentCount,
    lateCount: count("LATE"),
    excusedCount: count("EXCUSED"),
    unrecordedCount: count("NOT_RECORDED"),
    upcomingCount: count("UPCOMING"),
    totalRelevantClassSessions,
    absenceRate: totalRelevantClassSessions
      ? Math.round((absentCount * 10000) / totalRelevantClassSessions) / 100
      : 0,
    status,
  };
}

const reportPayload = attendanceReportSchema.extend({
  type: z.literal("ATTENDANCE_VIOLATION"),
  memberUserId: z.string().min(1),
  memberName: z.string(),
  className: z.string(),
  attendedCount: z.number(),
  absentCount: z.number(),
  totalSessions: z.number(),
  absenceRate: z.number(),
});
export function readAttendanceReport(description: string) {
  try {
    const parsed = reportPayload.safeParse(JSON.parse(description));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadAttendance(
  facilityId: string,
  filters: { memberId?: string; classId?: string } = {},
) {
  const now = new Date();
  const enrollments = await prisma.enrollment.findMany({
    where: {
      class: { facilityId },
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.classId ? { classId: filters.classId } : {}),
      status: { in: ["BOOKED", "COMPLETED"] },
      schedule: { status: { not: "CANCELLED" } },
    },
    include: {
      class: { select: { id: true, name: true, facilityId: true } },
      member: {
        select: {
          id: true,
          userId: true,
          user: { select: { fullName: true, email: true, phone: true } },
        },
      },
      schedule: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          room: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { memberId: "asc" },
      { classId: "asc" },
      { schedule: { startTime: "asc" } },
    ],
  });
  const memberIds = [...new Set(enrollments.map((e) => e.memberId))];
  const [coverage, records, warnings, reports] = await Promise.all([
    getMembershipCoverageIntervals(prisma, memberIds),
    prisma.attendance.findMany({
      where: {
        memberId: { in: memberIds },
        scheduleId: { in: enrollments.map((e) => e.scheduleId) },
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: { in: enrollments.map((e) => e.member.userId) },
        type: "ATTENDANCE_WARNING",
        metadata: { path: ["facilityId"], equals: facilityId },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.issue.findMany({
      where: { facilityId, requesterRole: "RECEPTIONIST" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const recordMap = new Map(
    records.map((r) => [`${r.memberId}|${r.scheduleId}`, r]),
  );
  const groups = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const key = `${e.memberId}|${e.classId}`;
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    const sessions = group
      .filter(
        (e) =>
          e.bookedAt <= e.schedule.startTime &&
          isCoveredAt(coverage.get(e.memberId) || [], e.schedule.startTime),
      )
      .map((e) => {
        const record = recordMap.get(`${e.memberId}|${e.scheduleId}`);
        return {
          enrollmentId: e.id,
          enrollmentStatus: e.status,
          scheduleId: e.scheduleId,
          startTime: e.schedule.startTime.toISOString(),
          endTime: e.schedule.endTime.toISOString(),
          roomName: e.schedule.room.name,
          state:
            e.schedule.endTime > now
              ? "UPCOMING"
              : record?.status || "NOT_RECORDED",
          note: record?.note || null,
        };
      });
    const ownWarnings = warnings.filter(
      (w) =>
        (w.metadata as { classId?: string } | null)?.classId ===
          first.classId && w.userId === first.member.userId,
    );
    const ownReports = reports.filter((r) => {
      const p = readAttendanceReport(r.description);
      return p?.memberId === first.memberId && p.classId === first.classId;
    });
    const report = ownReports[0];
    return {
      memberId: first.memberId,
      memberUserId: first.member.userId,
      memberName: first.member.user.fullName,
      memberEmail: first.member.user.email,
      memberPhone: first.member.user.phone,
      classId: first.classId,
      className: first.class.name,
      ...attendanceSummary(sessions),
      sessions,
      warningSent: ownWarnings.length > 0,
      warningSentAt: ownWarnings[0]?.createdAt || null,
      warnings: ownWarnings.map((w) => ({
        id: w.id,
        title: w.title,
        body: w.body,
        createdAt: w.createdAt,
      })),
      reports: ownReports.map((r) => ({
        id: r.id,
        status: r.status,
        response: r.response,
        createdAt: r.createdAt,
        decidedAt: r.updatedAt,
      })),
      reportId: report?.id || null,
      reportStatus: report
        ? ["OPEN", "IN_PROGRESS"].includes(report.status)
          ? "PENDING"
          : report.status === "RESOLVED"
            ? "APPROVED"
            : "REJECTED"
        : null,
    };
  });
}

export async function getReceptionAttendanceMonitoring(
  user: Staff,
  input: unknown,
) {
  const query = checked(monitoringQuerySchema, input);
  const facilityId = await getStaffFacilityId(user.id, user.role);
  const rows = await loadAttendance(facilityId, query);
  const search = query.search?.trim().toLocaleLowerCase("vi");
  const filtered = rows.filter(
    (r) =>
      (!search ||
        `${r.memberName} ${r.memberEmail} ${r.memberPhone || ""}`
          .toLocaleLowerCase("vi")
          .includes(search)) &&
      (!query.status || r.status === query.status),
  );
  const weights = { VIOLATION: 3, WARNING: 2, NORMAL: 1 };
  filtered.sort(
    (a, b) =>
      weights[b.status] - weights[a.status] ||
      b.absenceRate - a.absenceRate ||
      a.memberName.localeCompare(b.memberName, "vi") ||
      a.classId.localeCompare(b.classId),
  );
  return {
    items: filtered
      .slice((query.page - 1) * query.limit, query.page * query.limit)
      .map(({ sessions, warnings, reports, ...row }) => row),
    pagination: buildPaginationMeta(filtered.length, query.page, query.limit),
    facilityId,
  };
}

export async function getReceptionAttendanceDetail(
  user: Staff,
  input: unknown,
) {
  const pair = checked(attendancePairSchema, input);
  const facilityId = await getStaffFacilityId(user.id, user.role);
  const row = (await loadAttendance(facilityId, pair))[0];
  if (!row)
    throw new AppError(
      "Hội viên không có đăng ký trong lớp tại cơ sở này",
      404,
    );
  const subscription = await prisma.membershipSubscription.findFirst({
    where: {
      memberId: pair.memberId,
      status: "ACTIVE",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    include: { plan: true },
    orderBy: { endDate: "desc" },
  });
  const { sessions, warnings, reports, ...summary } = row;
  return {
    member: {
      id: row.memberId,
      userId: row.memberUserId,
      fullName: row.memberName,
      email: row.memberEmail,
      phone: row.memberPhone,
      subscription: subscription
        ? {
            planName: subscription.plan?.name,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
          }
        : null,
    },
    class: { id: row.classId, name: row.className },
    summary,
    sessions,
    warnings,
    reports,
  };
}

async function lockPair(
  tx: Prisma.TransactionClient,
  user: Staff,
  pair: { memberId: string; classId: string },
) {
  const facilityId = await getStaffFacilityId(user.id, user.role);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reception-attendance:${facilityId}:${pair.memberId}:${pair.classId}`}))`;
  return facilityId;
}

export async function sendReceptionAttendanceWarning(
  user: Staff,
  input: unknown,
) {
  const pair = checked(attendancePairSchema, input);
  return prisma.$transaction(async (tx) => {
    const facilityId = await lockPair(tx, user, pair);
    const detail = await getReceptionAttendanceDetail(user, pair);
    if (detail.summary.status === "NORMAL")
      throw new AppError("Hội viên chưa đạt ngưỡng cảnh báo 20%", 400);
    if (detail.warnings.length)
      return {
        alreadySent: true,
        message: "Cảnh báo cho lớp này đã được gửi",
        sentAt: detail.warnings[0].createdAt,
      };
    const notification = await createNotification(
      detail.member.userId,
      "ATTENDANCE_WARNING",
      `Cảnh báo chuyên cần: ${detail.class.name}`,
      `Bạn đã vắng ${detail.summary.absentCount}/${detail.summary.totalRelevantClassSessions} buổi (${detail.summary.absenceRate}%). Vui lòng liên hệ lễ tân nếu cần đối chiếu điểm danh.`,
      {
        metadata: {
          facilityId,
          classId: pair.classId,
          memberId: pair.memberId,
          absenceRate: detail.summary.absenceRate,
          sentByStaffId: user.id,
          policy: "RECEPTION_20_30",
        },
      },
    );
    return {
      alreadySent: false,
      message: "Đã gửi cảnh báo chuyên cần",
      sentAt: notification.createdAt,
    };
  });
}

export async function submitAttendanceViolationReport(
  user: Staff,
  input: unknown,
) {
  const body = checked(attendanceReportSchema, input);
  return prisma.$transaction(async (tx) => {
    const facilityId = await lockPair(tx, user, body);
    const detail = await getReceptionAttendanceDetail(user, body);
    if (detail.summary.status !== "VIOLATION")
      throw new AppError("Chỉ báo cáo khi tỷ lệ vắng đạt từ 30%", 400);
    if (
      detail.reports.some((r) =>
        ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(r.status),
      )
    )
      throw new AppError(
        "Đã có báo cáo chuyên cần đang chờ duyệt hoặc đã được duyệt",
        409,
      );
    const issue = await prisma.issue.create({
      data: {
        facilityId,
        memberId: detail.member.userId,
        requesterId: user.id,
        requesterRole: "RECEPTIONIST",
        title: `Vi phạm chuyên cần: ${detail.member.fullName} · ${detail.class.name}`,
        description: JSON.stringify({
          type: "ATTENDANCE_VIOLATION",
          ...body,
          memberUserId: detail.member.userId,
          memberName: detail.member.fullName,
          className: detail.class.name,
          attendedCount: detail.summary.attendedCount,
          absentCount: detail.summary.absentCount,
          totalSessions: detail.summary.totalRelevantClassSessions,
          absenceRate: detail.summary.absenceRate,
        }),
        status: "OPEN",
      },
    });
    const managers = await prisma.facilityStaff.findMany({
      where: { facilityId, role: "MANAGER", isActive: true },
      select: { userId: true },
    });
    for (const manager of managers)
      await createNotification(
        manager.userId,
        "GENERAL",
        "Báo cáo vi phạm chuyên cần",
        issue.title,
        { metadata: { issueId: issue.id, facilityId, classId: body.classId } },
      );
    return { reportId: issue.id, message: "Đã gửi báo cáo lên quản lý cơ sở" };
  });
}

export async function reviewAttendanceViolationReport(
  user: Staff,
  reportId: string,
  input: unknown,
) {
  const body = checked(attendanceReviewSchema, input);
  const facilityId = await getStaffFacilityId(user.id, user.role);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance-report:${reportId}`}))`;
    const issue = await tx.issue.findFirst({
      where: { id: reportId, facilityId, requesterRole: "RECEPTIONIST" },
    });
    const payload = issue && readAttendanceReport(issue.description);
    if (!issue || !payload)
      throw new AppError("Không tìm thấy báo cáo chuyên cần hợp lệ", 404);
    if (!["OPEN", "IN_PROGRESS"].includes(issue.status))
      throw new AppError("Báo cáo đã được xử lý", 409);
    await lockMemberQuota(tx, payload.memberId);
    await lockMemberClass(tx, payload.memberId, payload.classId);
    const detail = await getReceptionAttendanceDetail(user, payload);
    if (detail.member.userId !== payload.memberUserId)
      throw new AppError("Báo cáo không khớp hội viên", 409);
    if (
      body.decision === "APPROVE_REMOVAL" &&
      detail.summary.status !== "VIOLATION"
    )
      throw new AppError(
        "Điểm danh đã thay đổi; hội viên không còn vi phạm 30%. Hãy từ chối báo cáo và kiểm tra lại.",
        409,
      );
    const future =
      body.decision === "APPROVE_REMOVAL"
        ? await tx.enrollment.findMany({
            where: {
              memberId: payload.memberId,
              classId: payload.classId,
              status: "BOOKED",
              schedule: { startTime: { gt: new Date() }, status: "SCHEDULED" },
            },
            select: { id: true },
          })
        : [];
    if (future.length)
      await tx.enrollment.updateMany({
        where: { id: { in: future.map((e) => e.id) } },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    const report = await tx.issue.update({
      where: { id: issue.id },
      data: {
        status: body.decision === "APPROVE_REMOVAL" ? "RESOLVED" : "CLOSED",
        response: body.response,
        resolvedBy: user.id,
      },
    });
    await createNotification(
      payload.memberUserId,
      "GENERAL",
      "Kết quả xem xét chuyên cần",
      body.decision === "APPROVE_REMOVAL"
        ? `Quản lý đã hủy đăng ký lớp ${payload.className}. Lý do: ${body.response}`
        : `Bạn tiếp tục học lớp ${payload.className}. ${body.response}`,
      { metadata: { issueId: issue.id, facilityId, classId: payload.classId } },
    );
    if (issue.requesterId)
      await createNotification(
        issue.requesterId,
        "GENERAL",
        "Báo cáo chuyên cần đã được xử lý",
        body.response,
        { metadata: { issueId: issue.id, facilityId } },
      );
    return {
      report,
      decision: body.decision,
      releasedSessionsCount: future.length,
    };
  });
}
