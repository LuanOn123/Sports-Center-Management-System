import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorizeExact } from "../../middlewares/authorize.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { validate } from "../../middlewares/validate.js";
import { sendCreated, sendSuccess } from "../../utils/response.js";
import { draftWorkout } from "../ai/ai.service.js";

const router = Router({ mergeParams: true });
const attendeeStatus = ["BOOKED", "COMPLETED"] as const;
const planText = z.object({
  title: z.string().trim().min(2).max(120),
  instructions: z.string().trim().min(3).max(6000),
  homework: z.string().trim().max(3000).nullable().optional(),
});
const target = z.object({ memberId: z.string().min(1).nullable().optional() });
const planAuthor = {
  coach: { select: { user: { select: { fullName: true } } } },
};

async function getAssignedCoach(classId: string, userId: string) {
  const cls = await prisma.class.findFirst({
    where: { id: classId, coaches: { some: { coach: { userId } } } },
    select: {
      name: true,
      sports: { select: { name: true } },
      coaches: {
        where: { coach: { userId } },
        select: { coachId: true },
        take: 1,
      },
    },
  });
  if (!cls?.coaches[0])
    throw new AppError("Giáo án chỉ dành cho HLV được phân công lớp này.", 403);
  return {
    name: cls.name,
    sports: cls.sports.map(({ name }) => name),
    coachId: cls.coaches[0].coachId,
  };
}

async function getTrainingMember(classId: string, memberId: string) {
  const member = await prisma.memberProfile.findFirst({
    where: {
      id: memberId,
      enrollments: { some: { classId, status: { in: [...attendeeStatus] } } },
    },
    select: {
      trainingLevel: true,
      fitnessGoal: true,
      courseGoals: {
        where: { classId },
        select: { goal: true, progress: true },
        take: 1,
      },
      slotEvaluations: {
        where: { schedule: { classId } },
        orderBy: { schedule: { startTime: "desc" } },
        select: { newProgress: true },
        take: 5,
      },
    },
  });
  if (!member) throw new AppError("Hội viên này chưa đăng ký lớp.", 404);
  return member;
}

router.get(
  "/",
  authenticate,
  authorizeExact("COACH", "MEMBER"),
  async (req, res) => {
    const classId = String(req.params.id);
    if (req.user!.role === "MEMBER") {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          classId,
          member: { userId: req.user!.id },
          status: { in: [...attendeeStatus] },
        },
        select: { memberId: true },
      });
      const plans = enrollment
        ? await prisma.trainingPlan.findMany({
            where: {
              classId,
              OR: [{ memberId: null }, { memberId: enrollment.memberId }],
            },
            orderBy: { createdAt: "desc" },
            include: planAuthor,
          })
        : [];
      return sendSuccess(res, { plans });
    }

    const { coachId } = await getAssignedCoach(classId, req.user!.id);
    const [plans, enrollments] = await Promise.all([
      prisma.trainingPlan.findMany({
        where: { classId },
        orderBy: { createdAt: "desc" },
        include: {
          ...planAuthor,
          member: { select: { user: { select: { fullName: true } } } },
        },
      }),
      prisma.enrollment.findMany({
        where: { classId, status: { in: [...attendeeStatus] } },
        distinct: ["memberId"],
        select: {
          memberId: true,
          member: { select: { user: { select: { fullName: true } } } },
        },
      }),
    ]);
    return sendSuccess(res, {
      plans: plans.map((plan) => ({
        ...plan,
        editable: plan.coachId === coachId,
      })),
      members: enrollments.map(({ memberId, member }) => ({
        id: memberId,
        name: member.user.fullName,
      })),
    });
  },
);

router.post(
  "/",
  authenticate,
  authorizeExact("COACH"),
  validate(planText.merge(target)),
  async (req, res) => {
    const classId = String(req.params.id);
    const { coachId, name } = await getAssignedCoach(classId, req.user!.id);
    const { memberId, title, instructions, homework } = req.body;
    const plan = await prisma.$transaction(async (tx) => {
      const recipients = await tx.enrollment.findMany({
        where: {
          classId,
          ...(memberId && { memberId }),
          status: { in: [...attendeeStatus] },
          member: { user: { isActive: true, role: "MEMBER" } },
        },
        distinct: ["memberId"],
        select: { memberId: true, member: { select: { userId: true } } },
      });
      if (memberId && !recipients.length) throw new AppError("Hội viên này chưa đăng ký lớp.", 404);
      const created = await tx.trainingPlan.create({
        data: {
          classId,
          coachId,
          memberId: memberId ?? null,
          title,
          instructions,
          homework: homework || null,
        },
      });
      if (recipients.length) {
        await tx.notificationOutbox.createMany({
          data: recipients.map(({ member }) => ({
            userId: member.userId,
            type: "TRAINING_PLAN_ASSIGNED",
            title: `Giáo án mới · ${name}`,
            body: title,
            metadata: { classId, trainingPlanId: created.id },
          })),
        });
      }
      return created;
    });
    return sendCreated(res, plan);
  },
);

router.patch(
  "/:planId",
  authenticate,
  authorizeExact("COACH"),
  validate(planText),
  async (req, res) => {
    const classId = String(req.params.id);
    const { coachId } = await getAssignedCoach(classId, req.user!.id);
    const { title, instructions, homework } = req.body;
    const update = await prisma.trainingPlan.updateMany({
      where: { id: String(req.params.planId), classId, coachId },
      data: { title, instructions, homework: homework || null },
    });
    if (!update.count)
      throw new AppError("Không tìm thấy giáo án của bạn trong lớp này.", 404);
    return sendSuccess(res, { id: String(req.params.planId) });
  },
);

router.post(
  "/suggest",
  authenticate,
  authorizeExact("COACH"),
  validate(
    target.extend({
      objective: z.string().trim().max(300).optional(),
    }),
  ),
  async (req, res) => {
    const classId = String(req.params.id);
    const { name, sports } = await getAssignedCoach(classId, req.user!.id);
    const { memberId, objective } = req.body;
    const member = memberId
      ? await getTrainingMember(classId, memberId)
      : undefined;
    const draft = await draftWorkout({
      label: name,
      sports,
      objective,
      member,
    });
    return sendSuccess(res, { draft });
  },
);

export default router;
