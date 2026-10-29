import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import type { CreateFeedbackInput, UpdateFeedbackInput, FeedbackQueryInput } from "./feedbacks.schema.js";

const feedbackInclude = {
  coach: { include: { user: { select: { fullName: true, email: true } } } },
  member: { include: { user: { select: { fullName: true } } } },
  class: { select: { id: true, name: true } },
};

/**
 * Member tạo feedback cho Coach.
 * Business rules (R-06):
 *  - "Đã học" = có mặt (Attendance PRESENT/LATE) hoặc Enrollment COMPLETED ở ít nhất 1 buổi
 *    ĐÃ DIỄN RA do HLV đó dạy (HLV chính khi buổi không có người thay, HLV dạy thay, hoặc HLV phụ).
 *    Chỉ đặt chỗ (BOOKED) cho buổi tương lai thì chưa được đánh giá.
 *  - Có classId ⇒ buổi đã học phải thuộc ĐÚNG lớp đó.
 *  - Mỗi (member, coach, class) chỉ 1 feedback; mỗi (member, coach) chỉ 1 feedback chung (không lớp).
 *    Gửi lại ⇒ sửa feedback cũ.
 */
export async function createFeedback(data: CreateFeedbackInput, userId: string) {
  // Tìm memberProfile từ userId
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError("Member profile not found", 404);

  // Tìm coachProfile
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { id: data.coachId },
    include: { user: true },
  });
  if (!coachProfile || !coachProfile.user.isActive) throw new AppError("Coach not found or inactive", 404);

  const coachId = data.coachId;
  const pastSessionTaughtByCoach = {
    startTime: { lte: new Date() },
    ...(data.classId ? { classId: data.classId } : {}),
    OR: [
      { coachId },
      { coachId: null, class: { coaches: { some: { coachId } } } },
      { class: { coaches: { some: { coachId, isPrimary: false } } } },
    ],
  };
  const [attended, completed] = await Promise.all([
    prisma.attendance.findFirst({
      where: { memberId: memberProfile.id, status: { in: ["PRESENT", "LATE"] }, schedule: pastSessionTaughtByCoach },
      select: { id: true },
    }),
    prisma.enrollment.findFirst({
      where: { memberId: memberProfile.id, status: "COMPLETED", schedule: pastSessionTaughtByCoach },
      select: { id: true },
    }),
  ]);
  if (!attended && !completed) {
    throw new AppError(
      data.classId
        ? "Bạn chỉ có thể đánh giá HLV ở lớp mà bạn đã tham gia ít nhất một buổi do HLV này dạy."
        : "Bạn chỉ có thể đánh giá HLV sau khi đã tham gia ít nhất một buổi do HLV này dạy.",
      403,
      { code: "FEEDBACK_NOT_ELIGIBLE" },
    );
  }

  const content = {
    rating: data.rating,
    comment: data.comment,
    isAnonymous: data.isAnonymous ?? false,
  };

  if (data.classId) {
    return prisma.coachFeedback.upsert({
      where: { coachId_memberId_classId: { coachId, memberId: memberProfile.id, classId: data.classId } },
      create: { coachId, memberId: memberProfile.id, classId: data.classId, ...content },
      update: content,
      include: feedbackInclude,
    });
  }

  // Feedback chung (classId NULL): unique của PostgreSQL không chặn trùng NULL ⇒ tìm & sửa bản cũ;
  // partial unique index "CoachFeedback_general_unique" chặn hai request tạo song song.
  const upsertGeneral = async () => {
    const existing = await prisma.coachFeedback.findFirst({
      where: { coachId, memberId: memberProfile.id, classId: null },
      select: { id: true },
    });
    return existing
      ? prisma.coachFeedback.update({ where: { id: existing.id }, data: content, include: feedbackInclude })
      : prisma.coachFeedback.create({ data: { coachId, memberId: memberProfile.id, ...content }, include: feedbackInclude });
  };
  try {
    return await upsertGeneral();
  } catch (err: any) {
    if (err?.code === "P2002") return upsertGeneral();
    throw err;
  }
}

/**
 * Lấy danh sách feedback của 1 Coach (công khai cho user đã đăng nhập).
 * - `isAnonymous = true` → KHÔNG trả `memberId`/`member` cho bất kỳ ai (chống truy ngược tác giả);
 *   chính tác giả xem bản của mình qua `GET /feedbacks/my`.
 * - Mọi item kèm `isOwn` để FE biết có thể sửa/xóa.
 */
export async function listFeedbacksForCoach(query: FeedbackQueryInput, actorId?: string) {
  const { coachId, classId } = query;
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;

  if (!coachId) throw new AppError("coachId là bắt buộc", 400);

  const where: any = { coachId };
  if (classId) where.classId = classId;

  const [total, feedbacks, ownProfile] = await Promise.all([
    prisma.coachFeedback.count({ where }),
    prisma.coachFeedback.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: feedbackInclude,
    }),
    actorId
      ? prisma.memberProfile.findUnique({ where: { userId: actorId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  const ownMemberId = ownProfile?.id ?? null;
  const sanitized = feedbacks.map(({ memberId, member, ...rest }) => {
    const isOwn = Boolean(ownMemberId) && memberId === ownMemberId;
    if (rest.isAnonymous) {
      return { ...rest, isOwn };
    }
    return { ...rest, memberId, member, isOwn };
  });

  // Tính điểm trung bình
  const avgResult = await prisma.coachFeedback.aggregate({
    where: { coachId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    feedbacks: sanitized,
    pagination: buildPaginationMeta(total, page, limit),
    summary: {
      averageRating: avgResult._avg.rating ? Math.round(avgResult._avg.rating * 10) / 10 : null,
      totalFeedbacks: avgResult._count.rating,
    },
  };
}

/**
 * Member xem feedback mình đã gửi.
 */
export async function getMyFeedbacks(userId: string) {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError("Member profile not found", 404);

  return prisma.coachFeedback.findMany({
    where: { memberId: memberProfile.id },
    orderBy: { createdAt: "desc" },
    include: feedbackInclude,
  });
}

/**
 * Member xóa feedback của mình.
 */
export async function deleteFeedback(feedbackId: string, userId: string) {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError("Member profile not found", 404);

  const feedback = await prisma.coachFeedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new AppError("Feedback not found", 404);
  if (feedback.memberId !== memberProfile.id) throw new AppError("Forbidden: not your feedback", 403);

  await prisma.coachFeedback.delete({ where: { id: feedbackId } });
  return { message: "Feedback đã được xóa thành công." };
}

/**
 * Manager xóa feedback vi phạm.
 */
export async function deleteFeedbackByManager(feedbackId: string) {
  const feedback = await prisma.coachFeedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new AppError("Feedback not found", 404);
  await prisma.coachFeedback.delete({ where: { id: feedbackId } });
  return { message: "Feedback đã được xóa bởi quản lý." };
}
