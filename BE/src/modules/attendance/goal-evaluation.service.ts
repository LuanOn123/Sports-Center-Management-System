import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { effectiveCoachIds } from "../operations/effective-coaches.js";
import { createNotification } from "../notifications/notifications.service.js";

/**
 * Đảm bảo Member có một MemberCourseGoal cho (memberId, classId).
 * Nếu chưa có thì khởi tạo theo fallback:
 * 1. requestedGoal (nếu có)
 * 2. memberProfile.fitnessGoal (từ hồ sơ cá nhân)
 * 3. "Hoàn thành khóa học [Tên lớp]"
 */
export async function ensureMemberCourseGoal(
  memberId: string,
  classId: string,
  requestedGoal?: string | null
) {
  const existing = await prisma.memberCourseGoal.findUnique({
    where: { memberId_classId: { memberId, classId } },
  });

  if (existing) {
    if (requestedGoal && requestedGoal.trim() && requestedGoal.trim() !== existing.goal) {
      return prisma.memberCourseGoal.update({
        where: { id: existing.id },
        data: { goal: requestedGoal.trim() },
      });
    }
    return existing;
  }

  const [member, cls] = await Promise.all([
    prisma.memberProfile.findUnique({ where: { id: memberId } }),
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
  ]);

  if (!cls) throw new AppError("Class not found", 404);

  const fallbackGoal =
    requestedGoal?.trim() ||
    member?.fitnessGoal?.trim() ||
    `Hoàn thành khóa học ${cls.name}`;

  return prisma.memberCourseGoal.create({
    data: {
      memberId,
      classId,
      goal: fallbackGoal,
      progress: 0,
      status: "IN_PROGRESS",
    },
  });
}

/**
 * Lấy danh sách tiến độ & đánh giá của tất cả học viên trong một buổi học (schedule).
 */
export async function getScheduleEvaluations(
  scheduleId: string,
  actor: { id: string; role: string }
) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      class: {
        include: {
          coaches: { include: { coach: true } },
        },
      },
      evaluations: true,
      enrollments: {
        where: { status: { in: ["BOOKED", "COMPLETED"] } },
        select: { memberId: true },
      },
    },
  });

  if (!schedule) throw new AppError("Schedule not found", 404);

  if (actor.role === "COACH") {
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: actor.id } });
    if (!coachProfile || !effectiveCoachIds(schedule).includes(coachProfile.id)) {
      throw new AppError("Forbidden: You are not assigned to teach this class", 403);
    }
  }

  const memberIds = [...new Set(schedule.enrollments.map((e) => e.memberId))];

  const goals = await prisma.memberCourseGoal.findMany({
    where: {
      classId: schedule.classId,
      memberId: { in: memberIds },
    },
  });

  const goalMap = new Map(goals.map((g) => [g.memberId, g]));
  const evalMap = new Map(schedule.evaluations.map((e) => [e.memberId, e]));

  return memberIds.map((mId) => {
    const goal = goalMap.get(mId);
    const evaluation = evalMap.get(mId);
    return {
      memberId: mId,
      goalId: goal?.id ?? null,
      goal: goal?.goal ?? `Hoàn thành khóa học ${schedule.class.name}`,
      currentProgress: goal?.progress ?? 0,
      evaluation: evaluation
        ? {
            id: evaluation.id,
            previousProgress: evaluation.previousProgress,
            newProgress: evaluation.newProgress,
            description: evaluation.description,
            createdAt: evaluation.createdAt,
            updatedAt: evaluation.updatedAt,
          }
        : null,
    };
  });
}

/**
 * Huấn luyện viên hoặc Quản lý lưu đánh giá tiến độ cho một học viên trong buổi học.
 */
export async function saveScheduleEvaluation(
  scheduleId: string,
  memberId: string,
  data: { progress: number; description?: string | null },
  actor: { id: string; role: string }
) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      class: {
        include: {
          coaches: {
            include: { coach: { include: { user: { select: { fullName: true } } } } },
          },
        },
      },
    },
  });

  if (!schedule) throw new AppError("Schedule not found", 404);

  let coachProfileId: string | null = null;
  let coachName = "Huấn luyện viên";

  if (actor.role === "COACH") {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: actor.id },
      include: { user: { select: { fullName: true } } },
    });
    if (!coachProfile || !effectiveCoachIds(schedule).includes(coachProfile.id)) {
      throw new AppError("Forbidden: You are not assigned to teach this class", 403);
    }
    coachProfileId = coachProfile.id;
    coachName = coachProfile.user.fullName;
  } else if (["ADMIN", "MANAGER"].includes(actor.role)) {
    const assigned = schedule.class.coaches[0]?.coach;
    if (assigned) {
      coachProfileId = assigned.id;
      coachName = assigned.user.fullName;
    } else {
      const anyCoach = await prisma.coachProfile.findFirst({
        include: { user: { select: { fullName: true } } },
      });
      if (!anyCoach) throw new AppError("No coach profile available for evaluation", 400);
      coachProfileId = anyCoach.id;
      coachName = anyCoach.user.fullName;
    }
  } else {
    throw new AppError("Forbidden: Only Coach or Manager can evaluate progress", 403);
  }

  // 1. Đảm bảo có mục tiêu khóa học
  const courseGoal = await ensureMemberCourseGoal(memberId, schedule.classId);

  // 2. Chuẩn hóa progress 0 - 100
  const cleanProgress = Math.max(0, Math.min(100, Math.round(Number(data.progress) || 0)));
  const cleanDescription = data.description?.trim() || null;

  // 3. Kiểm tra đánh giá cũ của buổi này (nếu có)
  const existingEval = await prisma.slotEvaluation.findUnique({
    where: { scheduleId_memberId: { scheduleId, memberId } },
  });

  const previousProgress = existingEval ? existingEval.previousProgress : courseGoal.progress;

  // 4. Lưu / Cập nhật SlotEvaluation
  const evaluation = await prisma.slotEvaluation.upsert({
    where: { scheduleId_memberId: { scheduleId, memberId } },
    create: {
      scheduleId,
      memberId,
      coachId: coachProfileId,
      goalId: courseGoal.id,
      previousProgress,
      newProgress: cleanProgress,
      description: cleanDescription,
    },
    update: {
      coachId: coachProfileId,
      goalId: courseGoal.id,
      newProgress: cleanProgress,
      description: cleanDescription,
    },
  });

  // 5. Cập nhật tiến độ vào MemberCourseGoal
  const updatedGoal = await prisma.memberCourseGoal.update({
    where: { id: courseGoal.id },
    data: {
      progress: cleanProgress,
      status: cleanProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  // 6. Gửi thông báo đến Member
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: { userId: true },
  });

  if (member?.userId) {
    const diff = cleanProgress - previousProgress;
    const diffSign = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "0%";
    const scheduleDate = new Date(schedule.startTime).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });

    const bodyMessage =
      `HLV ${coachName} đã đánh giá buổi học ngày ${scheduleDate} (lớp "${schedule.class.name}"): ` +
      `Tiến độ đạt ${cleanProgress}% (${diffSign}).` +
      (cleanDescription ? ` Lời dặn: "${cleanDescription}"` : "");

    createNotification(
      member.userId,
      "GOAL_PROGRESS_UPDATED",
      `🎯 HLV cập nhật tiến độ mục tiêu của bạn`,
      bodyMessage,
      {
        metadata: {
          scheduleId,
          classId: schedule.classId,
          previousProgress,
          newProgress: cleanProgress,
          diff,
          description: cleanDescription,
        },
      }
    ).catch(() => {});
  }

  return { evaluation, goal: updatedGoal };
}

/**
 * Member xem mục tiêu và toàn bộ lịch sử đánh giá của khóa học.
 */
export async function getMyClassGoal(classId: string, userId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });
  if (!member) throw new AppError("Member profile not found", 404);

  let courseGoal = await prisma.memberCourseGoal.findUnique({
    where: { memberId_classId: { memberId: member.id, classId } },
  });

  if (!courseGoal) {
    // Chỉ tự tạo nếu học viên thực sự đã đăng ký lớp này (hỗ trợ dữ liệu cũ)
    const hasEnrollment = await prisma.enrollment.findFirst({
      where: {
        memberId: member.id,
        status: { in: ["BOOKED", "COMPLETED"] },
        OR: [{ classId }, { schedule: { classId } }],
      },
    });

    if (!hasEnrollment) {
      return null;
    }

    courseGoal = await ensureMemberCourseGoal(member.id, classId);
  }

  const evaluations = await prisma.slotEvaluation.findMany({
    where: {
      memberId: member.id,
      schedule: { classId },
    },
    include: {
      schedule: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          room: { select: { name: true } },
        },
      },
      coach: {
        include: {
          user: { select: { fullName: true } },
        },
      },
    },
    orderBy: { schedule: { startTime: "asc" } },
  });

  return {
    id: courseGoal.id,
    classId: courseGoal.classId,
    goal: courseGoal.goal,
    progress: courseGoal.progress,
    status: courseGoal.status,
    evaluations: evaluations.map((ev) => ({
      id: ev.id,
      scheduleId: ev.scheduleId,
      startTime: ev.schedule.startTime,
      endTime: ev.schedule.endTime,
      roomName: ev.schedule.room?.name,
      coachName: ev.coach?.user?.fullName || "Huấn luyện viên",
      previousProgress: ev.previousProgress,
      newProgress: ev.newProgress,
      diff: ev.newProgress - ev.previousProgress,
      description: ev.description,
      createdAt: ev.createdAt,
    })),
  };
}

/**
 * Member không thể tự ý sửa mục tiêu sau khi đã đăng ký khóa học
 * nhằm đảm bảo tính toàn vẹn của lộ trình giảng dạy và đánh giá của HLV.
 */
export async function updateMyClassGoal(_classId: string, _userId: string, _newGoal: string) {
  throw new AppError(
    "Mục tiêu khóa học đã được cố định sau khi đăng ký để Huấn luyện viên theo dõi đánh giá và không thể thay đổi.",
    400
  );
}
