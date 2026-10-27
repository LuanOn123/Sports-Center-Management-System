import type { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";

type RequesterRecord = {
  requesterId: string | null;
  requesterRole: UserRole | null;
  coachId?: string | null;
  memberId?: string | null;
};

/** Resolve only the identities referenced by already facility-scoped requests. */
export async function withRequesters<T extends RequesterRecord>(rows: T[]) {
  const coachIds = rows.flatMap((row) =>
    !row.requesterId && row.coachId ? [row.coachId] : [],
  );
  const profiles = coachIds.length
    ? await prisma.coachProfile.findMany({
        where: { id: { in: coachIds } },
        select: { id: true, userId: true },
      })
    : [];
  const coachUsers = new Map(
    profiles.map((profile) => [profile.id, profile.userId]),
  );
  const requesterId = (row: T) =>
    row.requesterId ||
    row.memberId ||
    (row.coachId ? coachUsers.get(row.coachId) : undefined);
  const ids = [
    ...new Set(
      rows.flatMap((row) => (requesterId(row) ? [requesterId(row)!] : [])),
    ),
  ];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true, role: true },
      })
    : [];
  const byId = new Map(users.map((user) => [user.id, user]));
  return rows.map((row) => {
    const user = byId.get(requesterId(row) || "");
    return {
      ...row,
      user,
      requester: user
        ? { ...user, role: row.requesterRole || user.role }
        : null,
    };
  });
}

import {
  enqueueNotification,
  flushNotificationOutbox,
} from "../notifications/outbox.service.js";

export async function createStaffLeave(
  user: { id: string; role: string },
  input: { startTime: string; endTime: string; reason: string },
) {
  if (user.role === "COACH") throw new AppError("Vui lòng gửi yêu cầu đổi huấn luyện viên theo buổi học.", 400);
  if (user.role !== "COACH" && user.role !== "RECEPTIONIST")
    throw new AppError("Only facility staff can submit leave", 403);
  const trimmedReason = input.reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 1000) {
    throw new AppError("Lý do xin nghỉ phải từ 3 đến 1000 ký tự", 400);
  }
  const startDate = new Date(input.startTime);
  const endDate = new Date(input.endTime);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError("Thời gian nghỉ không hợp lệ", 400);
  }
  if (endDate <= startDate) {
    throw new AppError("Thời gian kết thúc phải sau thời gian bắt đầu", 400);
  }

  const coach =
    user.role === "COACH"
      ? await prisma.coachProfile.findUnique({ where: { userId: user.id } })
      : null;
  if (user.role === "COACH" && !coach)
    throw new AppError("Coach not found", 404);

  const facilityId = requestContext.getStore()!.facilityId!;

  const leave = await prisma.$transaction(async (tx) => {
    const createdLeave = await tx.leaveRequest.create({
      data: {
        requesterId: user.id,
        requesterRole: user.role as UserRole,
        coachId: coach?.id,
        facilityId,
        reason: trimmedReason,
        startTime: startDate,
        endTime: endDate,
      },
    });

    const managers = await tx.facilityStaff.findMany({
      where: {
        facilityId,
        role: "MANAGER",
        isActive: true,
        user: { isActive: true },
      },
      select: { userId: true },
    });
    let recipientUserIds = [...new Set(managers.map((m) => m.userId))];

    if (recipientUserIds.length === 0) {
      const admins = await tx.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      recipientUserIds = admins.map((a) => a.id);
    }

    const facilityRow = await tx.facility.findUnique({
      where: { id: facilityId },
      select: { name: true },
    });
    const sender = await tx.user.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    });

    const senderName = sender?.fullName || "Nhân sự";
    const roleText = user.role === "COACH" ? "Huấn luyện viên" : "Lễ tân";
    const facilityName = facilityRow?.name || "cơ sở";

    const fmt = (d: Date) =>
      d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const inclusiveEndDate = new Date(endDate.getTime() - 1000);
    const dateRangeStr =
      fmt(startDate) === fmt(inclusiveEndDate)
        ? `ngày ${fmt(startDate)}`
        : `từ ${fmt(startDate)} đến ${fmt(inclusiveEndDate)}`;

    for (const managerUserId of recipientUserIds) {
      await enqueueNotification(tx, {
        userId: managerUserId,
        type: "LEAVE_REQUEST_SUBMITTED",
        title: `Đơn xin nghỉ phép: ${senderName}`,
        body: `${senderName} (${roleText}) đã gửi đơn xin nghỉ phép tại ${facilityName} ${dateRangeStr}. Lý do: ${trimmedReason}`,
        metadata: {
          leaveRequestId: createdLeave.id,
          facilityId,
          requesterId: user.id,
          requesterRole: user.role,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
    }

    return createdLeave;
  });

  await flushNotificationOutbox().catch(() => {});
  return leave;
}

export function issueOwner(user: { id: string; role: string }) {
  if (user.role === "MEMBER")
    return {
      OR: [{ requesterId: user.id }, { requesterId: null, memberId: user.id }],
    };
  if (user.role === "COACH") return { requesterId: user.id };
  return {};
}
