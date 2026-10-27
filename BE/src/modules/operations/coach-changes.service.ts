import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { lockSchedule } from "../../utils/dbLocks.js";
import { updateSchedule } from "../class-schedules/class-schedules.service.js";
import {
  enqueueNotification,
  flushNotificationOutbox,
} from "../notifications/outbox.service.js";
import { validateResources } from "./scheduling.js";

type Actor = { id: string; role: string };
const facility = () => {
  const id = requestContext.getStore()?.facilityId;
  if (!id) throw new AppError("Chưa xác định cơ sở.", 400);
  return id;
};
const scheduleInclude = {
  class: { include: { sports: true, coaches: true } },
  room: true,
} as const;
const requestInclude = {
  schedule: { include: scheduleInclude },
  requester: { include: { user: { select: { fullName: true } } } },
  replacement: { include: { user: { select: { fullName: true } } } },
} as const;

function teachesSession(schedule: any, coachId: string) {
  if (schedule.coachId) return schedule.coachId === coachId;
  const assigned = schedule.class.coaches;
  const lead =
    assigned.find((coach: any) => coach.isPrimary) ??
    (assigned.length === 1 ? assigned[0] : undefined);
  return lead?.coachId === coachId;
}

export function assertRequestableSession(
  schedule: any,
  coachId: string,
  now = new Date(),
) {
  if (!schedule || schedule.status !== "SCHEDULED" || schedule.startTime <= now)
    throw new AppError(
      "Chỉ có thể yêu cầu đổi HLV cho buổi học sắp diễn ra.",
      409,
    );
  if (!teachesSession(schedule, coachId))
    throw new AppError("Bạn không được phân công giảng dạy buổi học này.", 403);
}

export async function listCoachChanges(user: Actor) {
  return prisma.coachChangeRequest.findMany({
    where: {
      facilityId: facility(),
      ...(user.role === "COACH" ? { requester: { userId: user.id } } : {}),
    },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function requestableSessions(user: Actor) {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: user.id },
  });
  if (!coach) throw new AppError("Không tìm thấy hồ sơ huấn luyện viên.", 404);
  const sessions = await prisma.classSchedule.findMany({
    where: {
      class: { facilityId: facility() },
      status: "SCHEDULED",
      startTime: { gt: new Date() },
      OR: [
        { coachId: coach.id },
        { coachId: null, class: { coaches: { some: { coachId: coach.id } } } },
      ],
      coachChangeRequests: {
        none: { requesterCoachId: coach.id, status: "PENDING" },
      },
    },
    include: scheduleInclude,
    orderBy: { startTime: "asc" },
    take: 200,
  });
  return sessions.filter((session) => teachesSession(session, coach.id));
}

export async function createCoachChange(
  user: Actor,
  input: { scheduleId: string; reason: string },
  db = prisma,
) {
  if (user.role !== "COACH")
    throw new AppError(
      "Chỉ huấn luyện viên được gửi yêu cầu đổi buổi dạy.",
      403,
    );
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 1000)
    throw new AppError("Lý do phải từ 3 đến 1000 ký tự.", 400);
  const result = await db.$transaction(async (tx) => {
    const coach = await tx.coachProfile.findUnique({
      where: { userId: user.id },
    });
    if (!coach)
      throw new AppError("Không tìm thấy hồ sơ huấn luyện viên.", 404);
    await lockSchedule(tx, input.scheduleId);
    const session = await tx.classSchedule.findFirst({
      where: { id: input.scheduleId, class: { facilityId: facility() } },
      include: scheduleInclude,
    });
    assertRequestableSession(session, coach.id);
    const duplicate = await tx.coachChangeRequest.findFirst({
      where: {
        scheduleId: input.scheduleId,
        requesterCoachId: coach.id,
        status: "PENDING",
      },
    });
    if (duplicate)
      throw new AppError("Buổi học này đã có yêu cầu đang chờ duyệt.", 409);
    const row = await tx.coachChangeRequest.create({
      data: {
        facilityId: facility(),
        scheduleId: session!.id,
        requesterCoachId: coach.id,
        reason,
        requestedStartTime: session!.startTime,
        requestedEndTime: session!.endTime,
      },
    });
    const managers = await tx.facilityStaff.findMany({
      where: {
        facilityId: facility(),
        role: "MANAGER",
        isActive: true,
        user: { isActive: true },
      },
      select: { userId: true },
    });
    for (const id of new Set(managers.map((m) => m.userId)))
      await enqueueNotification(tx, {
        userId: id,
        type: "COACH_CHANGE_REQUESTED",
        title: "Yêu cầu đổi huấn luyện viên",
        body: `Có yêu cầu đổi HLV cho buổi học ${session!.class.name}. Lý do: ${reason}`,
        metadata: {
          coachChangeRequestId: row.id,
          scheduleId: session!.id,
          facilityId: facility(),
        },
      });
    return row;
  });
  if (db === prisma) await flushNotificationOutbox().catch(() => {});
  return result;
}

export async function replacementCandidates(id: string) {
  const row = await prisma.coachChangeRequest.findFirst({
    where: { id, facilityId: facility(), status: "PENDING" },
    include: { schedule: { include: scheduleInclude } },
  });
  if (!row) throw new AppError("Không tìm thấy yêu cầu đang chờ duyệt.", 404);
  const coaches = await prisma.coachProfile.findMany({
    where: {
      id: { not: row.requesterCoachId },
      user: {
        isActive: true,
        facilityStaffs: {
          some: { facilityId: facility(), role: "COACH", isActive: true },
        },
      },
    },
    include: { specializations: true, user: { select: { fullName: true } } },
  });
  const results = [];
  for (const coach of coaches) {
    if (
      !row.schedule.class.sports.every((sport) =>
        coach.specializations.some((s) => s.sportId === sport.id),
      )
    )
      continue;
    const conflict = await requestContext.run(
      { ...requestContext.getStore(), facilityId: undefined },
      () =>
        prisma.classSchedule.findFirst({
          where: {
            id: { not: row.scheduleId },
            status: "SCHEDULED",
            startTime: { lt: row.schedule.endTime },
            endTime: { gt: row.schedule.startTime },
            OR: [
              { coachId: coach.id },
              {
                coachId: null,
                class: { coaches: { some: { coachId: coach.id } } },
              },
            ],
          },
        }),
    );
    if (!conflict)
      results.push({ id: coach.id, fullName: coach.user.fullName });
  }
  return results;
}

export async function decideCoachChange(
  user: Actor,
  id: string,
  input: { status: "APPROVED" | "REJECTED"; reason: string; coachId?: string },
  db = prisma,
  changeSchedule = updateSchedule,
) {
  if (user.role !== "MANAGER")
    throw new AppError(
      "Quản lý cơ sở thực hiện duyệt đổi huấn luyện viên.",
      403,
    );
  if (input.reason.trim().length < 3 || input.reason.trim().length > 1000)
    throw new AppError("Lý do xử lý phải từ 3 đến 1000 ký tự.", 400);
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"coach-change:" + id}))`;
    const row = await tx.coachChangeRequest.findFirst({
      where: { id, facilityId: facility() },
      include: requestInclude,
    });
    if (!row || row.status !== "PENDING")
      throw new AppError("Yêu cầu không còn ở trạng thái chờ duyệt.", 409);
    await lockSchedule(tx, row.scheduleId);
    if (input.status === "APPROVED") {
      if (!input.coachId || input.coachId === row.requesterCoachId)
        throw new AppError("Vui lòng chọn huấn luyện viên thay thế.", 400);
      const session = await tx.classSchedule.findFirst({
        where: { id: row.scheduleId, class: { facilityId: facility() } },
        include: scheduleInclude,
      });
      assertRequestableSession(session, row.requesterCoachId);
      if (
        session!.startTime.getTime() !== row.requestedStartTime.getTime() ||
        session!.endTime.getTime() !== row.requestedEndTime.getTime()
      )
        throw new AppError(
          "Lịch buổi học đã thay đổi. Vui lòng từ chối yêu cầu này và đề nghị gửi lại.",
          409,
        );
      await changeSchedule(row.scheduleId, {
        coachId: input.coachId,
        reason: input.reason.trim(),
      });
      await validateResources(
        tx,
        session!.roomId,
        session!.classId,
        session!.startTime,
        session!.endTime,
        input.coachId,
      );
    }
    const updated = await tx.coachChangeRequest.update({
      where: { id },
      data: {
        status: input.status,
        decisionReason: input.reason.trim(),
        decidedAt: new Date(),
        decidedBy: user.id,
        ...(input.status === "APPROVED"
          ? { replacementCoachId: input.coachId }
          : {}),
      },
    });
    const recipients = new Set([row.requester.userId]);
    if (input.status === "APPROVED") {
      const replacement = await tx.coachProfile.findUnique({
        where: { id: input.coachId! },
      });
      if (replacement) recipients.add(replacement.userId);
    }
    for (const userId of recipients)
      await enqueueNotification(tx, {
        userId,
        type:
          input.status === "APPROVED"
            ? "COACH_CHANGE_APPROVED"
            : "COACH_CHANGE_REJECTED",
        title:
          input.status === "APPROVED"
            ? "Đã duyệt đổi huấn luyện viên"
            : "Yêu cầu đổi HLV bị từ chối",
        body: `${row.schedule.class.name}: ${input.reason.trim()}`,
        metadata: {
          coachChangeRequestId: id,
          scheduleId: row.scheduleId,
          facilityId: facility(),
        },
      });
    return updated;
  });
  if (db === prisma) await flushNotificationOutbox().catch(() => {});
  return result;
}
