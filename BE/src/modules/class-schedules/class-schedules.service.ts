import { mergeRequirements } from "../operations/rules.js";
import { requestContext } from "../../config/request-context.js";
import { validateResources } from "../operations/scheduling.js";
import { prisma } from "../../config/prisma.js";
import { Prisma, EnrollmentStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { broadcastNotification, createNotification } from "../notifications/notifications.service.js";
import { ATTENDANCE } from "../../config/attendance.js";
import { scanAttendanceWarnings } from "../attendance/attendance.service.js";
import { lockSchedule } from "../../utils/dbLocks.js";
import {
  getMembershipCoverageIntervals,
  isCoveredAt,
} from "../attendance/attendance-analytics.service.js";
import { assertCanScheduleInTerm } from "../terms/terms.service.js";
import { checkFacilityClassLimit, checkFacilitySportLimit } from "../facilities/facility-limits.service.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

// Advisory lock theo resource để serialize Room/Coach trong cùng transaction.
// Tự release khi transaction commit/rollback (pg_advisory_xact_lock).
// Dùng $executeRaw thay vì $queryRaw vì function trả về void, không có row để deserialize.
async function lockScheduleResources(db: DbClient, roomIds: string[], coachIds: string[]) {
  for (const roomId of sortedUnique(roomIds)) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schedule:room:' || ${roomId}::text))`;
  }
  for (const coachId of sortedUnique(coachIds)) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schedule:coach:' || ${coachId}::text))`;
  }
}

async function getCoachIdsOfClass(db: DbClient, classId: string): Promise<string[]> {
  const rows = await db.classMember.findMany({ where: { classId }, select: { coachId: true } });
  return rows.map((r) => r.coachId);
}

async function checkConflicts(
  db: DbClient,
  roomId: string,
  classId: string,
  startTime: Date,
  endTime: Date,
  excludeScheduleId?: string,
  effectiveCoach?: string
) {
  await validateResources(db, roomId, classId, startTime, endTime, effectiveCoach);
  // Room conflict
  const roomConflict = await db.classSchedule.findFirst({
    where: {
      roomId,
      status: "SCHEDULED",
      id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: { class: true },
  });

  if (roomConflict) {
    throw new AppError(
      `Room is already booked for "${roomConflict.class.name}" from ${roomConflict.startTime.toISOString()} to ${roomConflict.endTime.toISOString()}`,
      409
    );
  }

  // Coach conflict – get coaches of this class
  const assignments = await db.classMember.findMany({ where: { classId } });
  const classCoaches = effectiveCoach
    ? [...assignments.filter((row) => !row.isPrimary), { coachId: effectiveCoach }]
    : assignments;
  for (const cm of classCoaches) {
    const coachConflict = await requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () => db.classSchedule.findFirst({
      where: {
        status: "SCHEDULED",
        id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        OR: [{ coachId: cm.coachId }, { coachId: null, class: { coaches: { some: { coachId: cm.coachId } } } }, { class: { coaches: { some: { coachId: cm.coachId, isPrimary: false } } } }],
      },
      include: {
        class: {
          include: {
            coaches: {
              where: { coachId: cm.coachId },
              include: { coach: { include: { user: { select: { fullName: true } } } } },
            },
          },
        },
      },
    }));

    if (coachConflict) {
      const coachName =
        coachConflict.class.coaches[0]?.coach?.user?.fullName ?? "Coach";
      throw new AppError(
        `Coach "${coachName}" already has a class at this time: ${coachConflict.startTime.toISOString()} – ${coachConflict.endTime.toISOString()}`,
        409
      );
    }
  }
}

export async function checkScheduleConflicts(
  db: DbClient,
  roomId: string,
  classId: string,
  startTime: Date,
  endTime: Date,
  excludeScheduleId?: string, effectiveCoach?: string
) {
  return checkConflicts(db, roomId, classId, startTime, endTime, excludeScheduleId, effectiveCoach);
}

export async function listSchedules(query: any) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (query.classId) where.classId = query.classId;
  if (query.roomId) where.roomId = query.roomId;
  if (query.termId) where.termId = query.termId;
  if (query.status) where.status = query.status;
  // Legacy start-time filtering (giữ backward compatibility cho FE hiện tại).
  if (query.startAfter) where.startTime = { ...where.startTime, gte: new Date(query.startAfter) };
  if (query.startBefore) where.startTime = { ...where.startTime, lte: new Date(query.startBefore) };
  if (query.date) {
    const d = new Date(query.date);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);
    where.startTime = { gte: d, lt: nextDay };
  }
  // Overlap-range filtering: schedule.startTime < to AND schedule.endTime > from.
  // Chạm biên (end == from, start == to) không tính overlap, thống nhất checkConflicts/transfer.
  if (query.from || query.to) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (query.from && Number.isNaN(from!.getTime())) throw new AppError("Invalid from datetime", 400);
    if (query.to && Number.isNaN(to!.getTime())) throw new AppError("Invalid to datetime", 400);
    delete where.startTime;
    if (from && to) {
      where.startTime = { lt: to };
      where.endTime = { gt: from };
    } else if (from) {
      where.endTime = { gt: from };
    } else if (to) {
      where.startTime = { lt: to };
    }
  }

  // Lọc Thứ 2..CN theo giờ VN (Asia/Ho_Chi_Minh), tính trên startTime.
  // Schema đã chuẩn hoá query.weekday/weekdays về mảng ISO 1..7 (Mon..Sun)
  // trong query.weekdayIso; tách riêng để chặn số lạ nếu validate bị bypass.
  const rawWeekdayIso: unknown = (query as { weekdayIso?: unknown }).weekdayIso;
  const weekdayIso: number[] | undefined = Array.isArray(rawWeekdayIso)
    ? [...new Set(rawWeekdayIso as unknown[])]
        .filter((v): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 7)
        .sort((a, b) => a - b)
    : undefined;

  const include = {
    class: { include: { sports: true } },
    room: true,
    term: true,
    _count: {
      select: {
        enrollments: {
          where: { status: { in: [EnrollmentStatus.BOOKED, EnrollmentStatus.COMPLETED] } },
        },
      },
    },
  };

  if (!weekdayIso || weekdayIso.length === 0) {
    const [total, schedules] = await Promise.all([
      prisma.classSchedule.count({ where }),
      prisma.classSchedule.findMany({
        where, skip, take: limit,
        include,
        orderBy: { startTime: "asc" },
      }),
    ]);
    return { schedules, pagination: buildPaginationMeta(total, page, limit) };
  }

  // Weekday chỉ lọc được đúng theo múi giờ VN bằng SQL:
  // EXTRACT(ISODOW FROM startTime AT TIME ZONE 'Asia/Ho_Chi_Minh') IN (...).
  const whereSql = buildWhereSql(where);
  const countRows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM "ClassSchedule" AS s
    ${whereSql.fragment}
    AND EXTRACT(ISODOW FROM s."startTime" AT TIME ZONE 'Asia/Ho_Chi_Minh') IN (${Prisma.join(weekdayIso)})`;
  const total = Number(countRows[0]?.total ?? 0);
  const schedules = await prisma.$queryRaw<any[]>`
    SELECT s.* FROM "ClassSchedule" AS s
    ${whereSql.fragment}
    AND EXTRACT(ISODOW FROM s."startTime" AT TIME ZONE 'Asia/Ho_Chi_Minh') IN (${Prisma.join(weekdayIso)})
    ORDER BY s."startTime" ASC
    LIMIT ${limit} OFFSET ${skip}`;
  if (schedules.length === 0) {
    return { schedules: [], pagination: buildPaginationMeta(total, page, limit) };
  }
  const ids = schedules.map((s) => s.id);
  const rows = await prisma.classSchedule.findMany({
    where: { id: { in: ids } },
    include,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Giữ đúng thứ tự ORDER BY startTime từ query raw.
  const ordered = ids.map((id) => byId.get(id)).filter((r) => r !== undefined);
  return { schedules: ordered, pagination: buildPaginationMeta(total, page, limit) };
}

// Dựng WHERE SQL từ object `where` của Prisma cho GET list (khi cần lọc weekday).
// Chỉ hỗ trợ đúng các key mà listSchedules đang dùng: classId/roomId/status + startTime/endTime.
function buildWhereSql(where: any): { fragment: Prisma.Sql } {
  const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
  const scopedFacility = requestContext.getStore()?.facilityId;
  if (scopedFacility) conds.push(Prisma.sql`s."classId" IN (SELECT id FROM "Class" WHERE "facilityId" = ${scopedFacility})`);
  if (where.classId) conds.push(Prisma.sql`s."classId" = ${where.classId}`);
  if (where.roomId) conds.push(Prisma.sql`s."roomId" = ${where.roomId}`);
  if (where.termId) conds.push(Prisma.sql`s."termId" = ${where.termId}`);
  if (where.status) conds.push(Prisma.sql`s."status"::text = ${where.status}`);
  const st = where.startTime;
  if (st?.gte) conds.push(Prisma.sql`s."startTime" >= ${st.gte}`);
  if (st?.gt) conds.push(Prisma.sql`s."startTime" > ${st.gt}`);
  if (st?.lte) conds.push(Prisma.sql`s."startTime" <= ${st.lte}`);
  if (st?.lt) conds.push(Prisma.sql`s."startTime" < ${st.lt}`);
  const et = where.endTime;
  if (et?.gte) conds.push(Prisma.sql`s."endTime" >= ${et.gte}`);
  if (et?.gt) conds.push(Prisma.sql`s."endTime" > ${et.gt}`);
  if (et?.lte) conds.push(Prisma.sql`s."endTime" <= ${et.lte}`);
  if (et?.lt) conds.push(Prisma.sql`s."endTime" < ${et.lt}`);
  return { fragment: Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` };
}

function assertClassRoomAreaMatch(classAreaType: string, roomAreaType: string) {
  if (classAreaType !== roomAreaType) {
    throw new AppError(
      `Class area type "${classAreaType}" does not match Room area type "${roomAreaType}"`,
      400
    );
  }
}

type ScheduleInput = { startTime: string; endTime: string };

// Resource locks cover validation and the single bulk insert, including concurrent requests.
async function createScheduleBatchInTx(tx: Prisma.TransactionClient, data: {
  classId: string; roomId: string; termId?: string; schedules: ScheduleInput[];
}) {
  const ordered = data.schedules.map((row) => ({ startTime: new Date(row.startTime), endTime: new Date(row.endTime) }))
    .sort((a, b) => +a.startTime - +b.startTime);
  if (!ordered.length || ordered.length > 500) throw new AppError("Chọn từ 1 đến 500 buổi học.", 400);
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i];
    if (!Number.isFinite(+row.startTime) || !Number.isFinite(+row.endTime) || row.endTime <= row.startTime)
      throw new AppError("Thời gian buổi học không hợp lệ.", 400);
    if (i && row.startTime < ordered[i - 1].endTime)
      throw new AppError("Các buổi trong lịch tạo mới không được trùng nhau.", 409);
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('class:assignment:' || ${data.classId}::text))`;
  const coachIds = await getCoachIdsOfClass(tx, data.classId);
  await lockScheduleResources(tx, [data.roomId], coachIds);
  const start = ordered[0].startTime, end = ordered[ordered.length - 1].endTime;
  // Validate static resources once; leave checks use actual sessions, not the gaps between them.
  await validateResources(tx, data.roomId, data.classId, start, end, undefined, ordered);
  const cls = await tx.class.findUnique({ where: { id: data.classId }, include: { sports: true } });
  if (cls!.sports.length !== 1) throw new AppError("Lớp phải có đúng một bộ môn trước khi tạo lịch. Vui lòng chỉnh sửa lớp.", 409);
  const room = await tx.room.findUnique({ where: { id: data.roomId } });
  const conflicts = await requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () => tx.classSchedule.findMany({
    where: { status: "SCHEDULED", startTime: { lt: end }, endTime: { gt: start }, OR: [
      { roomId: data.roomId }, { classId: data.classId }, { coachId: { in: coachIds } },
      { coachId: null, class: { coaches: { some: { coachId: { in: coachIds } } } } },
      { class: { coaches: { some: { coachId: { in: coachIds }, isPrimary: false } } } },
    ] }, select: { startTime: true, endTime: true },
  }));
  const clashing = ordered.filter((row) => conflicts.some((existing) => row.startTime < existing.endTime && row.endTime > existing.startTime));
  if (clashing.length) {
    // Nêu rõ buổi bị trùng để Manager sửa đúng chỗ thay vì đoán trong cả lô.
    const fmt = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
    const shown = clashing.slice(0, 5).map((row) => fmt(row.startTime)).join("; ");
    const more = clashing.length > 5 ? ` và ${clashing.length - 5} buổi khác` : "";
    throw new AppError(
      `Phòng, lớp hoặc huấn luyện viên (kể cả HLV phụ) đã có lịch trùng giờ ở ${clashing.length} buổi: ${shown}${more}. Vui lòng chọn ca khác.`,
      409,
      { code: "SCHEDULE_CONFLICT", conflictingSessions: clashing.map((row) => ({ startTime: row.startTime, endTime: row.endTime })) },
    );
  }
  const terms = await tx.term.findMany({ where: { OR: [{ facilityId: room!.facilityId }, { facilityId: null }] }, orderBy: { startDate: "asc" } });
  if (data.termId) await assertCanScheduleInTerm(data.termId, start, end, room!.facilityId, tx);
  const rows = ordered.map((row) => {
    const auto = terms.find((term) => term.facilityId === room!.facilityId && term.status !== "CLOSED" && term.startDate <= row.startTime && term.endDate >= row.endTime)
      ?? terms.find((term) => term.status !== "CLOSED" && term.startDate <= row.startTime && term.endDate >= row.endTime);
    if (!data.termId && !auto) throw new AppError("Hãy chọn kỳ học hợp lệ bao phủ các buổi cần tạo.", 409, { code: "TERM_REQUIRED" });
    return { ...row, classId: data.classId, roomId: data.roomId, termId: data.termId ?? auto?.id, status: "SCHEDULED" as const };
  });
  for (const termId of [...new Set(rows.map(row => row.termId!))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('term:' || ${termId}::text))`;
    const related = rows.filter(row => row.termId === termId);
    await assertCanScheduleInTerm(termId, related[0].startTime, related[related.length - 1].endTime, room!.facilityId, tx);
  }
  const result = await tx.classSchedule.createMany({ data: rows });
  return { schedulesCreated: result.count };
}

export async function createScheduleBatch(data: any) {
  return prisma.$transaction((tx) => createScheduleBatchInTx(tx, data), { timeout: 30000 });
}

export async function createSchedule(data: any) {
  return prisma.$transaction(async (tx) => {
    await createScheduleBatchInTx(tx, { ...data, schedules: [{ startTime: data.startTime, endTime: data.endTime }] });
    return tx.classSchedule.findFirst({ where: { classId: data.classId, roomId: data.roomId, startTime: new Date(data.startTime), status: "SCHEDULED" }, include: { class: { include: { sports: true } }, room: true, term: true } });
  }, { timeout: 30000 });
}

/**
 * Creates the complete quick-planner workflow in one database transaction.
 * Any validation or conflict error rolls back the sport, class, assignments,
 * and every schedule created by this request.
 */
export async function createActivityPlan(data: any, canCreateSport: boolean) {
  if (data.sport.mode === "new" && !canCreateSport) {
    throw new AppError("Bộ môn mới cần được Admin tạo trước khi xếp lịch.", 403);
  }

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: data.roomId } });
    if (!room || !room.isActive) throw new AppError("Room not found or inactive", 404);
    if (room.areaType !== data.class.areaType) {
      throw new AppError(
        `Class area type "${data.class.areaType}" does not match Room area type "${room.areaType}"`,
        400,
      );
    }
    if (room.capacity < data.class.capacity) {
      throw new AppError("Room capacity is too small for this class", 400);
    }

    const coachIds = [data.primaryCoachId, data.supportCoachId].filter(
      (id): id is string => Boolean(id),
    );
    const coaches = await tx.coachProfile.findMany({
      where: {
        id: { in: coachIds },
        user: { isActive: true, role: "COACH" },
      },
      select: { id: true },
    });
    if (coaches.length !== coachIds.length) {
      throw new AppError("Active coach not found", 404);
    }

    await lockScheduleResources(tx, [data.roomId], coachIds);

    let sport;
    if (data.sport.mode === "new") {
      const existing = await tx.sport.findUnique({ where: { name: data.sport.name } });
      if (existing) throw new AppError("Sport with this name already exists", 409);
      sport = await tx.sport.create({
        data: {
          name: data.sport.name,
          description: data.sport.description || undefined,
          areaTypes: [data.class.areaType],
        },
      });
    } else {
      sport = await tx.sport.findUnique({ where: { id: data.sport.id }, include: { requirements: true } });
      if (!sport || !sport.isActive) {
        throw new AppError("Sport not found or inactive", 404);
      }
      if (!sport.areaTypes.includes(data.class.areaType)) {
        throw new AppError(
          `Sport "${sport.name}" does not support area type "${data.class.areaType}"`,
          400,
        );
      }
    }

    const facilityId = (room as any).facilityId || requestContext.getStore()?.facilityId;
    if (facilityId) {
      await checkFacilityClassLimit(facilityId, tx);
      await checkFacilitySportLimit(facilityId, [sport.id], tx);
    }

    const cls = await tx.class.create({
      data: {
        requirementsSnapshot: mergeRequirements((sport as any).requirements ?? []),
        name: data.class.name,
        defaultRoomId: data.roomId,
        description: data.class.description || undefined,
        capacity: data.class.capacity,
        classType: data.class.classType,
        areaType: data.class.areaType,
        sports: { connect: { id: sport.id } },
        coaches: {
          create: coachIds.map((coachId) => ({
            coachId,
            isPrimary: coachId === data.primaryCoachId,
          })),
        },
      },
    });

    const result = await createScheduleBatchInTx(tx, { classId: cls.id, roomId: room.id, termId: data.termId, schedules: data.schedules });
    return { class: cls, sport, ...result };
  }, { timeout: 30_000 });
}

export async function getScheduleById(id: string) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id },
    include: {
      class: { include: { sports: true, coaches: { include: { coach: { include: { user: { select: { fullName: true } } } } } } } },
      room: true,
      term: true,
      _count: { select: { enrollments: { where: { status: { in: ["BOOKED", "COMPLETED"] } } } } },
    },
  });
  if (!schedule) throw new AppError("Schedule not found", 404);
  return schedule;
}

// Unified cancellation: SCHEDULED → CANCELLED + BOOKED enrollments → CANCELLED.
// A12: lock theo schedule (cùng khoá với booking) + re-read + CAS trạng thái.
// Idempotent: CANCELLED gọi lại không update, không notify. COMPLETED → 400.
async function cancelScheduleTx(
  tx: Prisma.TransactionClient,
  schedule: { id: string; classId: string; class: { name: string } },
  reason?: string
) {
  await lockSchedule(tx, schedule.id);
  const fresh = await tx.classSchedule.findUnique({ where: { id: schedule.id } });
  if (!fresh) throw new AppError("Schedule not found", 404);
  if (fresh.status === "COMPLETED") {
    throw new AppError("Cannot cancel a completed schedule", 400);
  }
  if (fresh.status === "CANCELLED") {
    const current = await tx.classSchedule.findUnique({
      where: { id: schedule.id },
      include: { class: { include: { sports: true } }, room: true },
    });
    return { updated: current!, reason: reason ?? "Lịch học bị hủy" };
  }

  await tx.enrollment.updateMany({
    where: { scheduleId: schedule.id, status: "BOOKED" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  const cancelled = await tx.classSchedule.updateMany({
    where: { id: schedule.id, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count === 0) {
    throw new AppError("Lịch học đã thay đổi trạng thái, vui lòng tải lại.", 409, {
      code: "SCHEDULE_STATE_CHANGED",
    });
  }
  const updated = await tx.classSchedule.findUnique({
    where: { id: schedule.id },
    include: { class: { include: { sports: true } }, room: true },
  });
  return { updated: updated!, reason: reason ?? "Lịch học bị hủy" };
}

/**
 * A11 — Dời giờ lịch có booking: mọi member đang giữ chỗ phải giữ được chỗ sau khi dời.
 * - Không trùng giờ với booking khác của chính họ.
 * - Vẫn nằm trong khoảng quyền lợi (A10) tại thời điểm học mới.
 * Vi phạm ⇒ 409 kèm danh sách member để FE/CSKH xử lý (không tự ý phá chỗ đã đặt).
 */
async function assertScheduleMoveKeepsBookingsValid(
  tx: Prisma.TransactionClient,
  params: { scheduleId: string; startTime: Date; endTime: Date; termId?: string | null }
) {
  const booked = await tx.enrollment.findMany({
    where: { scheduleId: params.scheduleId, status: "BOOKED" },
    select: { memberId: true, classId: true, schedule: { select: { termId: true } }, member: { select: { user: { select: { fullName: true } } } } },
  });
  if (booked.length === 0) return;

  const memberIds = booked.map((b) => b.memberId);
  const [conflicts, coverage] = await Promise.all([
    // A member's timetable spans facilities. Only this conflict lookup is
    // global; entitlement checks below still use the moved session's facility.
    requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () => tx.enrollment.findMany({
      where: {
        memberId: { in: memberIds },
        status: "BOOKED",
        scheduleId: { not: params.scheduleId },
        schedule: {
          status: { not: "CANCELLED" },
          startTime: { lt: params.endTime },
          endTime: { gt: params.startTime },
        },
      },
      select: { memberId: true },
    })),
    getMembershipCoverageIntervals(tx, memberIds),
  ]);

  const conflicted = new Set(conflicts.map((c) => c.memberId));
  const uncovered = booked.filter((row) => !isCoveredAt(coverage.get(row.memberId) ?? [], params.startTime, {
    scheduleId: params.scheduleId, classId: row.classId,
    termId: params.termId === undefined ? row.schedule.termId : params.termId, endTime: params.endTime,
  })).map((row) => row.memberId);
  if (conflicted.size === 0 && uncovered.length === 0) return;

  const nameOf = (memberId: string) =>
    booked.find((b) => b.memberId === memberId)?.member.user.fullName ?? memberId;
  throw new AppError(
    "Không thể dời lịch: một số hội viên đã giữ chỗ sẽ bị trùng giờ hoặc ngoài hạn gói.",
    409,
    {
      code: "SCHEDULE_MOVE_IMPACT",
      conflicts: [...conflicted].map(nameOf),
      uncovered: uncovered.map(nameOf),
    }
  );
}

export async function updateSchedule(id: string, data: any) {
  const existing = await prisma.classSchedule.findUnique({
    where: { id },
    include: { class: true, room: true },
  });
  if (!existing) throw new AppError("Schedule not found", 404);

  // P0-2: CLOSED immutable qua PATCH thông thường.
  if (existing.status === "COMPLETED") throw new AppError("Schedule is already completed", 400);
  if (existing.status === "CANCELLED") throw new AppError("Schedule is already cancelled", 400);

  // P0-1: PATCH không được set COMPLETED trực tiếp.
  if (data.status === "COMPLETED") {
    throw new AppError("Use /class-schedules/:id/complete to complete a schedule", 400);
  }

  const startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
  const endTime = data.endTime ? new Date(data.endTime) : existing.endTime;
  const roomId = data.roomId ?? existing.roomId;

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new AppError("Invalid startTime or endTime", 400);
  }
  if (endTime <= startTime) {
    throw new AppError("endTime must be strictly greater than startTime", 400);
  }

  const termTouched = data.termId !== undefined;
  let newTermId: string | null | undefined = undefined;
  const currentFacilityId = existing.room?.facilityId || existing.class?.facilityId;
  if (termTouched) {
    if (data.termId === null) {
      newTermId = null;
    } else {
      await assertCanScheduleInTerm(data.termId, startTime, endTime, currentFacilityId);
      newTermId = data.termId;
    }
  } else if (data.startTime || data.endTime) {
    if (existing.termId) {
      await assertCanScheduleInTerm(existing.termId, startTime, endTime, currentFacilityId);
    }
  }

  const timeOrRoomChanged = Boolean(
    data.startTime || data.endTime || data.roomId || data.coachId || termTouched
  );

  // Cancel qua PATCH: reuse unified cancel flow, không cho đổi room/time cùng lúc.
  if (data.status === "CANCELLED") {
    if (timeOrRoomChanged) {
      throw new AppError("Cannot change room/time when cancelling a schedule", 400);
    }
    const result = await prisma.$transaction(async (tx) => {
      return cancelScheduleTx(tx, existing as any, data.reason);
    });
    const enrolled = await prisma.enrollment.findMany({
      where: { scheduleId: id, status: "CANCELLED" },
      include: { member: { select: { userId: true } } },
    });
    const userIds = [...new Set(enrolled.map((e) => e.member.userId))];
    if (userIds.length > 0) {
      const startStr = result.updated.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      broadcastNotification(
        userIds,
        "SCHEDULE_CANCELLED",
        `Lịch học đã bị hủy: ${result.updated.class.name}`,
        `Lịch học "${result.updated.class.name}" vào lúc ${startStr} đã bị hủy. Vui lòng đặt lịch học khác.`,
        { reason: result.reason, metadata: { scheduleId: id, classId: result.updated.classId } }
      ).catch(() => {});
    }
    return result.updated;
  }

  // Đổi room/time/term: lock theo SCHEDULE (cùng khoá với booking — A12) rồi tới room/coaches, re-check trong tx.
  if (timeOrRoomChanged) {
    const updated = await prisma.$transaction(async (tx) => {
      // A12: mọi mutation lịch phải xếp hàng trên cùng advisory lock với booking.
      await lockSchedule(tx, id);
      const fresh = await tx.classSchedule.findUnique({ where: { id } });
      if (!fresh) throw new AppError("Schedule not found", 404);
      if (fresh.status !== "SCHEDULED") {
        throw new AppError("Lịch học đã thay đổi trạng thái, vui lòng tải lại.", 409, {
          code: "SCHEDULE_STATE_CHANGED",
        });
      }

      const room = await tx.room.findUnique({ where: { id: roomId } });
      if (!room || !room.isActive) throw new AppError("Room not found or inactive", 404);
      if (room.capacity < existing.class.capacity) {
        throw new AppError("Room capacity is too small for this class", 400);
      }
      assertClassRoomAreaMatch(existing.class.areaType, room.areaType);

      const coachIds = await getCoachIdsOfClass(tx, existing.classId);
      await lockScheduleResources(tx, [fresh.roomId, roomId], [...coachIds, ...([data.coachId ?? fresh.coachId].filter(Boolean) as string[])]);
      await checkConflicts(tx, roomId, existing.classId, startTime, endTime, id, data.coachId ?? fresh.coachId ?? undefined);

      // A11: không dời lịch nếu phá chỗ đã hợp lệ (trùng giờ / ngoài hạn gói của member đang giữ chỗ).
      const selectedTermId = termTouched ? newTermId : fresh.termId;
      if (selectedTermId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('term:' || ${selectedTermId}::text))`;
        await assertCanScheduleInTerm(selectedTermId, startTime, endTime, room.facilityId, tx);
      }
      if (termTouched && !newTermId) throw new AppError("Không thể bỏ kỳ học khỏi lịch vận hành.", 409);
      await assertScheduleMoveKeepsBookingsValid(tx, { scheduleId: id, startTime, endTime, termId: termTouched ? newTermId : existing.termId });

      // A12: CAS trạng thái — lịch vừa bị hủy/hoàn tất trong lúc chờ lock thì không ghi.
      const moved = await tx.classSchedule.updateMany({
        where: { id, status: "SCHEDULED" },
        data: {
          startTime,
          endTime,
          roomId,
          ...(data.coachId ? { coachId: data.coachId } : {}),
          ...(termTouched ? { termId: newTermId } : {}),
        },
      });
      if (moved.count === 0) {
        throw new AppError("Lịch học đã thay đổi trạng thái, vui lòng tải lại.", 409, {
          code: "SCHEDULE_STATE_CHANGED",
        });
      }

      return tx.classSchedule.findUnique({
        where: { id },
        include: { class: { include: { sports: true } }, room: true, term: true },
      });
    });
    if (!updated) throw new AppError("Schedule not found", 404);

    // Thông báo cho hội viên đã đặt chỗ khi lịch bị dời giờ/phòng.
    // (Enum đã có SCHEDULE_UPDATED nhưng trước đây chưa nơi nào phát.)
    const enrollments = await prisma.enrollment.findMany({
      where: { scheduleId: id, status: "BOOKED" },
      include: { member: { select: { userId: true } } },
    });
    const userIds = [...new Set(enrollments.map((e) => e.member.userId))];
    if (userIds.length > 0) {
      const fmt = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const changes: string[] = [];
      if (
        updated.startTime.getTime() !== existing.startTime.getTime() ||
        updated.endTime.getTime() !== existing.endTime.getTime()
      ) {
        changes.push(
          `Thời gian mới: ${fmt(updated.startTime)} – ${fmt(updated.endTime)} (trước đó: ${fmt(existing.startTime)} – ${fmt(existing.endTime)}).`
        );
      }
      if (updated.roomId !== existing.roomId) {
        changes.push(`Phòng mới: ${updated.room.name} (trước đó: ${existing.room.name}).`);
      }
      if (data.coachId && data.coachId !== existing.coachId) {
        const newCoach = await prisma.coachProfile.findUnique({
          where: { id: data.coachId },
          include: { user: { select: { fullName: true, id: true } } },
        });
        if (newCoach) {
          changes.push(`Huấn luyện viên mới: ${newCoach.user.fullName}.`);
          createNotification(
            newCoach.user.id,
            "COACH_CHANGED",
            `Phân công buổi học: ${updated.class.name}`,
            `Bạn được phân công phụ trách buổi học "${updated.class.name}" lúc ${fmt(updated.startTime)} tại ${updated.room.name}.`,
            { metadata: { scheduleId: id, classId: updated.classId, coachId: data.coachId } }
          ).catch(() => {});
        }
      }
      if (changes.length > 0) {
        const notifType =
          data.coachId &&
          data.coachId !== existing.coachId &&
          updated.roomId === existing.roomId &&
          updated.startTime.getTime() === existing.startTime.getTime()
            ? "COACH_CHANGED"
            : "SCHEDULE_UPDATED";
        broadcastNotification(
          userIds,
          notifType,
          `Lịch học đã thay đổi: ${updated.class.name}`,
          `Lịch học "${updated.class.name}" mà bạn đã đặt có thay đổi. ${changes.join(" ")} Vui lòng kiểm tra lại lịch của bạn.`,
          { metadata: { scheduleId: id, classId: updated.classId, ...(data.coachId ? { coachId: data.coachId } : {}) } }
        ).catch(() => {});
      }
    }

    return updated;
  }

  // Không có gì để đổi (ví dụ status=SCHEDULED trong khi đã SCHEDULED): trả hiện tại.
  return prisma.classSchedule.findUnique({
    where: { id },
    include: { class: { include: { sports: true } }, room: true, term: true },
  });
}

export async function deleteSchedule(id: string) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id },
    include: { class: true },
  });
  if (!schedule) throw new AppError("Schedule not found", 404);
  if (schedule.status === "COMPLETED") throw new AppError("Schedule is already completed", 400);
  if (schedule.status === "CANCELLED") {
    // Idempotent: không update, không notify lại.
    return { id, status: "CANCELLED" as const };
  }

  const enrolled = await prisma.enrollment.findMany({
    where: { scheduleId: id, status: "BOOKED" },
    include: { member: { select: { userId: true } } },
  });
  const enrolledUserIds = [...new Set(enrolled.map((e) => e.member.userId))];
  const startStr = schedule.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const result = await prisma.$transaction(async (tx) => {
    return cancelScheduleTx(tx, schedule as any, "Lịch học bị hủy");
  });

  // Notify sau commit — fire-and-forget
  if (enrolledUserIds.length > 0) {
    broadcastNotification(
      enrolledUserIds,
      "SCHEDULE_CANCELLED",
      `Lịch học đã bị hủy: ${schedule.class.name}`,
      `Lịch học "${schedule.class.name}" vào lúc ${startStr} đã bị hủy. Vui lòng đặt lịch học khác.`,
      { reason: result.reason, metadata: { scheduleId: id, classId: schedule.classId } }
    ).catch(() => {});
  }

  return { id, status: "CANCELLED" as const };
}

/**
 * BR-22: Complete a schedule after the class has finished.
 * Only allowed after endTime has passed.
 * Auto-transitions all remaining BOOKED enrollments to COMPLETED.
 */
export async function completeSchedule(id: string) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id },
    include: { class: { include: { sports: true } }, room: true },
  });
  if (!schedule) throw new AppError("Schedule not found", 404);
  if (schedule.status === "COMPLETED") return schedule; // idempotent
  if (schedule.status === "CANCELLED") throw new AppError("Cannot complete a cancelled schedule", 400);
  if (schedule.endTime > new Date()) {
    throw new AppError("Cannot complete a schedule that has not ended yet", 400);
  }

  const completed = await prisma.$transaction(async (tx) => {
    // A12: lock cùng khoá với booking + CAS trạng thái (không hoàn tất lịch vừa bị hủy).
    await lockSchedule(tx, id);
    const fresh = await tx.classSchedule.findUnique({ where: { id } });
    if (!fresh) throw new AppError("Schedule not found", 404);
    if (fresh.status === "CANCELLED") {
      throw new AppError("Cannot complete a cancelled schedule", 400);
    }
    if (fresh.status === "COMPLETED") {
      throw new AppError("Lịch học đã được hoàn tất bởi thao tác khác.", 409, {
        code: "SCHEDULE_STATE_CHANGED",
      });
    }

    // §4: No-show — tạo ABSENT hệ thống cho member BOOKED chưa được điểm danh.
    // Unique (scheduleId, memberId) + skipDuplicates chống tạo trùng.
    const booked = await tx.enrollment.findMany({
      where: { scheduleId: id, status: "BOOKED" },
      select: { memberId: true },
    });
    if (booked.length > 0) {
      const marked = await tx.attendance.findMany({
        where: { scheduleId: id },
        select: { memberId: true },
      });
      const markedSet = new Set(marked.map((m) => m.memberId));
      const missing = booked.filter((b) => !markedSet.has(b.memberId));
      if (missing.length > 0) {
        await tx.attendance.createMany({
          data: missing.map((m) => ({
            scheduleId: id,
            memberId: m.memberId,
            status: "ABSENT" as const,
            note: ATTENDANCE.SYSTEM_NO_SHOW_NOTE,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Mark all still-BOOKED enrollments as COMPLETED
    await tx.enrollment.updateMany({
      where: { scheduleId: id, status: "BOOKED" },
      data: { status: "COMPLETED" },
    });

    const closed = await tx.classSchedule.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { status: "COMPLETED" },
    });
    if (closed.count === 0) {
      throw new AppError("Lịch học đã thay đổi trạng thái, vui lòng tải lại.", 409, {
        code: "SCHEDULE_STATE_CHANGED",
      });
    }

    return tx.classSchedule.findUnique({
      where: { id },
      include: { class: { include: { sports: true } }, room: true },
    });
  });
  if (!completed) throw new AppError("Schedule not found", 404);

  // §7: quét lại chuyên cần của lớp và gửi warning cho các bucket WARN (dedupe theo rate).
  // Fire-and-forget để không chặn response; không ảnh hưởng kết quả complete.
  scanAttendanceWarnings(schedule.classId).catch(() => {});

  return completed;
}

/**
 * Rà soát các buổi học sắp diễn ra không đủ sĩ số tối thiểu (minCapacity)
 * để Quản lý cơ sở xem xét điều phối hoặc quyết định hủy/cho lớp nghỉ.
 */
export async function getUnderCapacitySchedules(query: any) {
  const hoursAhead = parseInt(query.hoursAhead ?? "48", 10) || 48;
  const now = new Date();
  const futureLimit = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const schedules = await prisma.classSchedule.findMany({
    where: {
      status: "SCHEDULED",
      startTime: { gte: now, lte: futureLimit },
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
    },
    include: {
      class: { select: { id: true, name: true, capacity: true, minCapacity: true } },
      room: { select: { id: true, name: true } },
      _count: {
        select: { enrollments: { where: { status: { in: ["BOOKED", "COMPLETED"] } } } },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const underCapacity = schedules
    .filter((s) => s._count.enrollments < s.class.minCapacity)
    .map((s) => ({
      id: s.id,
      classId: s.classId,
      className: s.class.name,
      roomName: s.room.name,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      bookedCount: s._count.enrollments,
      minCapacity: s.class.minCapacity,
      maxCapacity: s.class.capacity,
      shortfall: s.class.minCapacity - s._count.enrollments,
    }));

  return {
    total: underCapacity.length,
    hoursAhead,
    schedules: underCapacity,
  };
}
