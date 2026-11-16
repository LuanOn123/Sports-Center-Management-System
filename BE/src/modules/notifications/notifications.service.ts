import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";

export type NotificationTypeEnum =
  // Tài khoản
  | "MEMBER_REGISTERED"
  // Chat
  | "CHAT_MESSAGE"
  // Gói tập
  | "SUBSCRIPTION_EXPIRING"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_CANCELLED"
  // Lịch học
  | "UPCOMING_CLASS"
  | "SCHEDULE_CANCELLED"
  | "SCHEDULE_UPDATED"
  // Đặt lớp
  | "ENROLLMENT_CONFIRMED"
  | "ENROLLMENT_CANCELLED"
  // Kế hoạch tập luyện
  | "TRAINING_PLAN_ASSIGNED"
  // Lớp học mới
  | "NEW_CLASS"
  | "COACH_CHANGED"
  | "GOAL_PROGRESS_UPDATED"
  // Chuyên cần (Attendance)
  | "ATTENDANCE_WARNING"
  | "ATTENDANCE_PENALTY"
  | "ATTENDANCE_PENALTY_REVOKED"
  // Lịch học đổi phòng (bulk transfer Room hư)
  | "SCHEDULE_ROOM_CHANGED"
  // Thanh toán
  | "PAYMENT_SUCCESS"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_FAILED"
  // Nghỉ phép
  | "LEAVE_REQUEST_SUBMITTED"
  | "LEAVE_REQUEST_APPROVED"
  | "LEAVE_REQUEST_REJECTED"
  | "COACH_CHANGE_REQUESTED"
  | "COACH_CHANGE_APPROVED"
  | "COACH_CHANGE_REJECTED"
  // Chung
  | "GENERAL";

export const NotificationTypeValues = [
  "MEMBER_REGISTERED",
  "CHAT_MESSAGE",
  "SUBSCRIPTION_EXPIRING",
  "SUBSCRIPTION_EXPIRED",
  "SUBSCRIPTION_CANCELLED",
  "UPCOMING_CLASS",
  "SCHEDULE_CANCELLED",
  "SCHEDULE_UPDATED",
  "ENROLLMENT_CONFIRMED",
  "ENROLLMENT_CANCELLED",
  "TRAINING_PLAN_ASSIGNED",
  "NEW_CLASS",
  "COACH_CHANGED",
  "GOAL_PROGRESS_UPDATED",
  "ATTENDANCE_WARNING",
  "ATTENDANCE_PENALTY",
  "ATTENDANCE_PENALTY_REVOKED",
  "SCHEDULE_ROOM_CHANGED",
  "PAYMENT_SUCCESS",
  "PAYMENT_REFUNDED",
  "PAYMENT_FAILED",
  "LEAVE_REQUEST_SUBMITTED",
  "LEAVE_REQUEST_APPROVED",
  "LEAVE_REQUEST_REJECTED",
  "COACH_CHANGE_REQUESTED",
  "COACH_CHANGE_APPROVED",
  "COACH_CHANGE_REJECTED",
  "GENERAL",
] as const;

export const GetNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be greater than or equal to 1").default(1),
  limit: z.coerce.number().int().min(1).max(100, "Limit cannot exceed 100").default(20),
  isRead: z.enum(["true", "false"], {
    errorMap: () => ({ message: "isRead must be 'true' or 'false'" }),
  }).optional(),
  type: z.enum(NotificationTypeValues, {
    errorMap: () => ({ message: "Invalid notification type" }),
  }).optional(),
});

/**
 * Internal helper — gửi một notification cho một user.
 * Luôn fire-and-forget (không await ở ngoài) để không block response.
 */
export async function createNotification(
  userId: string,
  type: NotificationTypeEnum,
  title: string,
  body: string,
  options?: {
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      reason: options?.reason ?? null,
      ...(options?.metadata ? { metadata: options.metadata as object } : {}),
    },
  });
}

/**
 * Gửi notification đến nhiều user (batch).
 * Ví dụ: thông báo lớp mới cho tất cả thành viên.
 *
 * Không dedupe ở DB: Notification không có unique constraint nên không dùng
 * `skipDuplicates` (đã gỡ vì misleading). Dedupe thật (nếu cần) làm ở caller,
 * ví dụ UPCOMING_CLASS check findFirst theo metadata.scheduleId trong 24h.
 */
export async function broadcastNotification(
  userIds: string[],
  type: NotificationTypeEnum,
  title: string,
  body: string,
  options?: { reason?: string; metadata?: Record<string, unknown> }
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      reason: options?.reason ?? null,
      metadata: options?.metadata ? (options.metadata as object) : undefined,
    })),
  });
}

/**
 * Gửi thông báo & Socket.io đến các Lễ tân khi có yêu cầu hoàn tiền mới (từ member hủy gói hoặc yêu cầu hoàn tiền).
 * Nếu có facilityId, ưu tiên gửi cho Lễ tân của đúng cơ sở đó; nếu chưa phân cơ sở thì gửi cho tất cả Lễ tân đang active.
 * Đồng thời gửi thông báo ngược lại cho Member biết lễ tân nào sẽ phụ trách và CTA nhắn tin.
 */
export async function notifyReceptionistsAboutRefund(params: {
  facilityId?: string | null;
  paymentId: string;
  memberUserId?: string;
  memberName?: string;
  refundAmount: number;
  reason: string;
}) {
  const { facilityId, paymentId, memberUserId, memberName, refundAmount, reason } = params;

  // ── 1. Tìm danh sách Lễ tân phụ trách cơ sở ──────────────────────────────
  let receptionistUserIds: string[] = [];
  if (facilityId) {
    const staff = await prisma.facilityStaff.findMany({
      where: {
        facilityId,
        role: "RECEPTIONIST",
        isActive: true,
      },
      select: { userId: true },
    });
    receptionistUserIds = staff.map((s) => s.userId);
  }

  if (receptionistUserIds.length === 0) {
    const all = await prisma.user.findMany({
      where: { role: "RECEPTIONIST", isActive: true },
      select: { id: true },
    });
    receptionistUserIds = all.map((u) => u.id);
  }

  if (receptionistUserIds.length === 0) return;

  // ── 2. Notify Lễ tân ──────────────────────────────────────────────────────
  const title = "Yêu cầu hoàn tiền mới";
  const body = `Hội viên ${memberName || "Hội viên"} vừa yêu cầu hoàn tiền ${Number(refundAmount).toLocaleString("vi-VN")}đ (Giao dịch #${paymentId.slice(0, 8)}). Lý do: ${reason}`;

  await prisma.notification.createMany({
    data: receptionistUserIds.map((userId) => ({
      userId,
      type: "PAYMENT_REFUNDED",
      title,
      body,
      reason,
      metadata: {
        paymentId,
        facilityId,
        memberUserId,
        memberName,
        refundAmount: Number(refundAmount),
        action: "REFUND_REQUEST",
      },
    })),
  });

  // ── 3. Notify Member: lễ tân nào đang phụ trách, CTA nhắn tin ────────────
  if (memberUserId) {
    // Dùng lễ tân đầu tiên làm người phụ trách đại diện
    const primaryReceptionistId = receptionistUserIds[0];
    let receptionistFullName = "Lễ tân trung tâm";
    try {
      const rec = await prisma.user.findUnique({
        where: { id: primaryReceptionistId },
        select: { fullName: true },
      });
      if (rec?.fullName) receptionistFullName = rec.fullName;
    } catch {
      // keep default name
    }

    const memberTitle = "Yêu cầu hoàn tiền đã được tiếp nhận";
    const memberBody = `Lễ tân ${receptionistFullName} đang phụ trách yêu cầu hoàn tiền ${Number(refundAmount).toLocaleString("vi-VN")}đ (Giao dịch #${paymentId.slice(0, 8)}) của bạn. Nhấn vào thông báo để nhắn tin trao đổi trực tiếp.`;

    await prisma.notification.create({
      data: {
        userId: memberUserId,
        type: "PAYMENT_REFUNDED",
        title: memberTitle,
        body: memberBody,
        reason,
        metadata: {
          paymentId,
          facilityId,
          receptionistUserId: primaryReceptionistId,
          receptionistName: receptionistFullName,
          refundAmount: Number(refundAmount),
          action: "REFUND_ASSIGNED",
        },
      },
    });

    try {
      const { getIo } = await import("../chat/chat.socket.js");
      const io = getIo();
      io.to(memberUserId).emit("newNotification", {
        title: memberTitle,
        body: memberBody,
        paymentId,
        refundAmount,
        receptionistUserId: primaryReceptionistId,
        receptionistName: receptionistFullName,
      });
    } catch {
      // Socket.io might not be running in tests
    }
  }

  // ── 4. Socket emit đến Lễ tân ─────────────────────────────────────────────
  try {
    const { getIo } = await import("../chat/chat.socket.js");
    const io = getIo();
    for (const uId of receptionistUserIds) {
      io.to(uId).emit("newNotification", {
        title,
        body,
        paymentId,
        refundAmount,
      });
      io.to(uId).emit("refundRequestCreated", {
        paymentId,
        facilityId,
        refundAmount,
        memberName,
      });
    }
  } catch {
    // Socket.io might not be running in tests
  }
}

// ─── CRUD API ──────────────────────────────────────────────────────────────

export async function getMyNotifications(userId: string, query: any) {
  const parsed = GetNotificationsQuerySchema.safeParse(query);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
      .join("; ");
    throw new AppError(`Invalid query parameters: ${errorMsg}`, 400);
  }

  const { page, limit, isRead, type } = parsed.data;
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (isRead !== undefined) where.isRead = isRead === "true";
  if (type) where.type = type;

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { notifications, pagination: buildPaginationMeta(total, page, limit) };
}

export async function markNotificationRead(id: string, userId: string) {
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) throw new AppError("Notification not found", 404);
  if (notif.userId !== userId) throw new AppError("Forbidden", 403);

  return prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { message: "All notifications marked as read" };
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
}

// ─── UPCOMING CLASS REMINDER (thủ công trigger) ───────────────────────────

/**
 * Gửi nhắc nhở cho tất cả hội viên có lớp trong 24h tới.
 * Gọi từ PATCH /class-schedules/:id/remind hoặc qua cron.
 * Idempotent: không gửi trùng nếu đã có UPCOMING_CLASS cho schedule+user trong 24h.
 */
export async function sendUpcomingClassReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Lấy tất cả lịch SCHEDULED trong 24h tới
  const upcomingSchedules = await prisma.classSchedule.findMany({
    where: {
      status: "SCHEDULED",
      startTime: { gte: now, lte: in24h },
    },
    include: {
      class: { include: { sports: true } },
      enrollments: {
        where: { status: "BOOKED" },
        include: { member: { select: { id: true, userId: true } } },
      },
    },
  });

  let sent = 0;
  for (const schedule of upcomingSchedules) {
    for (const enrollment of schedule.enrollments) {
      const userId = enrollment.member.userId;
      // Kiểm tra đã gửi chưa (tránh gửi trùng)
      const exists = await prisma.notification.findFirst({
        where: {
          userId,
          type: "UPCOMING_CLASS",
          metadata: { path: ["scheduleId"], equals: schedule.id },
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      });
      if (exists) continue;

      const startStr = schedule.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const sportNames = schedule.class.sports.map(s => s.name).join(", ");
      await createNotification(
        userId,
        "UPCOMING_CLASS",
        `Nhắc nhở: Lớp ${schedule.class.name} sắp bắt đầu`,
        `Lớp "${schedule.class.name}" (${sportNames}) sẽ bắt đầu lúc ${startStr}. Đừng quên chuẩn bị!`,
        { metadata: { scheduleId: schedule.id, classId: schedule.classId } }
      );
      sent++;
    }
  }
  return { sent, schedulesChecked: upcomingSchedules.length };
}
