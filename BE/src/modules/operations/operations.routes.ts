import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { checkFacilityScope } from "../../middlewares/facilityScope.js";
import { authorize, authorizeExact } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { expandPattern } from "./rules.js";
import { activateSubscriptionForPayment } from "../subscriptions/subscription-purchase.service.js";
import { validateResources } from "./scheduling.js";
import { getAuditFeed } from "./audit-feed.service.js";
import {
  createSchedule,
  updateSchedule,
} from "../class-schedules/class-schedules.service.js";
import {
  createStaffLeave,
  issueOwner,
  withRequesters,
} from "./requesters.service.js";
import { readAttendanceReport } from "../attendance/reception-attendance.service.js";
const router = Router();
const staff = authorize("ADMIN", "MANAGER");
const quantities = z.object({
  values: z.record(
    z.string().trim().min(1).max(80),
    z.union([z.number().int().nonnegative(), z.boolean()]).transform(Number),
  ),
});
const id = (req: any, name = "id") => String(req.params[name]);
const facility = () => requestContext.getStore()!.facilityId!;
const actor = () => requestContext.getStore()!.actorId!;
async function resolveCoachProfile(paramId: string) {
  let coach = await prisma.coachProfile.findUnique({
    where: { id: paramId },
  });
  if (!coach) {
    coach = await prisma.coachProfile.findUnique({
      where: { userId: paramId },
    });
  }
  return coach;
}

async function assertCoachFacility(coachIdentifier: string) {
  const coach = await resolveCoachProfile(coachIdentifier);
  if (!coach) throw new AppError("Coach not found", 404);
  if (requestContext.getStore()?.role !== "MANAGER") return coach;
  const facilityId = requestContext.getStore()?.facilityId;
  const staff = await prisma.facilityStaff.findFirst({
    where: {
      userId: coach.userId,
      role: "COACH",
      isActive: true,
      ...(facilityId ? { facilityId } : {}),
    },
  });
  if (!staff) throw new AppError("FORBIDDEN_SCOPE", 403);
  return coach;
}
export const operationHandlers: Record<string, (req: any) => any> = {};
const route = (
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  guards: any[],
  fn: (req: any) => any,
) => {
  operationHandlers[`${method.toUpperCase()} ${path}`] = fn;
  return router[method](
    path,
    authenticate,
    checkFacilityScope,
    ...guards,
    async (req, res) => sendSuccess(res, await fn(req)),
  );
};
route("get", "/staff-candidates", [staff], (req) =>
  requestContext.run(
    {
      ...requestContext.getStore(),
      facilityId: undefined,
    },
    () =>
      prisma.user.findMany({
        where: {
          isActive: true,
          ...(req.user.role === "ADMIN"
            ? {
                role: "MANAGER",
                facilityStaffs: { none: { role: "MANAGER", isActive: true } },
              }
            : { role: "COACH", facilityStaffs: { none: { isActive: true } } }),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          phone: true,
          avatarUrl: true,
          coachProfile: {
            select: {
              id: true,
              specialization: true,
              experienceYears: true,
              bio: true,
              specializations: {
                select: {
                  sport: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { fullName: "asc" },
      }),
  ),
);
route("get", "/coaches/:id/specializations", [], async (req) => {
  const coach = await assertCoachFacility(id(req));
  return prisma.coachSpecialization.findMany({ where: { coachId: coach.id } });
});
route("get", "/leave-requests/:id/affected", [staff], async (req) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: id(req) },
  });
  if (!leave) throw new AppError("Leave not found", 404);
  const coachId = leave.coachId;
  if (!coachId) return [];
  return requestContext.run(
    {
      ...requestContext.getStore(),
      ...(req.user.role === "ADMIN" ? { facilityId: undefined } : {}),
    },
    () =>
      prisma.classSchedule.findMany({
        where: {
          status: "SCHEDULED",
          startTime: { lt: leave.endTime },
          endTime: { gt: leave.startTime },
          OR: [
            { coachId: coachId },
            {
              coachId: null,
              class: { coaches: { some: { coachId: coachId } } },
            },
          ],
        },
        include: { class: true, room: true },
      }),
  );
});

route(
  "put",
  "/rooms/:id/capabilities",
  [staff, validate(quantities)],
  async (req) =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.room.findUnique({ where: { id: id(req) } })))
        throw new AppError("Room not found", 404);
      await tx.roomCapability.deleteMany({ where: { roomId: id(req) } });
      await tx.roomCapability.createMany({
        data: Object.entries(req.body.values).map(([key, quantity]) => ({
          roomId: id(req),
          key,
          quantity: quantity as number,
        })),
      });
      const sessions = await tx.classSchedule.findMany({
        where: {
          roomId: id(req),
          status: "SCHEDULED",
          endTime: { gt: new Date() },
        },
      });
      for (const s of sessions)
        await validateResources(
          tx,
          s.roomId,
          s.classId,
          s.startTime,
          s.endTime,
          s.coachId || undefined,
        );
      return tx.room.findUnique({
        where: { id: id(req) },
        include: { capabilities: true },
      });
    }),
);
route(
  "put",
  "/subjects/:id/requirements",
  [authorize("ADMIN"), validate(quantities)],
  (req) =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.sport.findUnique({ where: { id: id(req) } })))
        throw new AppError("Subject not found", 404);
      await tx.subjectRequirement.deleteMany({ where: { sportId: id(req) } });
      await tx.subjectRequirement.createMany({
        data: Object.entries(req.body.values).map(([key, minimum]) => ({
          sportId: id(req),
          key,
          minimum: minimum as number,
        })),
      });
      return tx.sport.findUnique({
        where: { id: id(req) },
        include: { requirements: true },
      });
    }),
);
route(
  "put",
  "/coaches/:id/specializations",
  [
    authorizeExact("MANAGER"),
    validate(z.object({ sportIds: z.array(z.string().trim().min(1)).min(1) })),
  ],
  (req) =>
    prisma.$transaction(async (tx) => {
      const coach = await assertCoachFacility(id(req));
      const coachId = coach.id;
      const targetSportIds = [...new Set<string>(req.body.sportIds)];

      const activeSports = await tx.sport.findMany({
        where: { id: { in: targetSportIds }, isActive: true },
      });
      if (activeSports.length !== targetSportIds.length) {
        throw new AppError("Một hoặc nhiều bộ môn không tồn tại hoặc đã ngừng hoạt động", 400);
      }

      const assignedActiveClasses = await tx.class.findMany({
        where: {
          isActive: true,
          coaches: { some: { coachId } },
        },
        include: { sports: true },
      });
      for (const cls of assignedActiveClasses) {
        const missing = cls.sports.filter((s) => !targetSportIds.includes(s.id));
        if (missing.length > 0) {
          throw new AppError(
            `Không thể gỡ bộ môn "${missing.map((s) => s.name).join(", ")}" vì HLV đang phụ trách lớp "${cls.name}". Hãy điều chỉnh phân công lớp trước.`,
            409,
          );
        }
      }

      const upcomingSessions = await tx.classSchedule.findMany({
        where: {
          status: "SCHEDULED",
          endTime: { gt: new Date() },
          coachId,
        },
        include: { class: { include: { sports: true } } },
      });
      for (const session of upcomingSessions) {
        const missing = session.class.sports.filter((s) => !targetSportIds.includes(s.id));
        if (missing.length > 0) {
          throw new AppError(
            `Không thể gỡ bộ môn "${missing.map((s) => s.name).join(", ")}" vì HLV có buổi dạy sắp tới của lớp "${session.class.name}". Hãy phân công HLV thay thế trước.`,
            409,
          );
        }
      }

      await tx.coachSpecialization.deleteMany({ where: { coachId } });
      await tx.coachSpecialization.createMany({
        data: targetSportIds.map((sportId) => ({
          coachId,
          sportId,
        })),
      });
      await requestContext.run(
        { ...requestContext.getStore(), facilityId: undefined },
        async () => {
          const sessions = await tx.classSchedule.findMany({
            where: {
              status: "SCHEDULED",
              endTime: { gt: new Date() },
              OR: [
                { coachId },
                {
                  coachId: null,
                  class: { coaches: { some: { coachId } } },
                },
              ],
            },
          });
          for (const s of sessions)
            await validateResources(
              tx,
              s.roomId,
              s.classId,
              s.startTime,
              s.endTime,
              s.coachId || undefined,
            );
        },
      );
      return tx.coachSpecialization.findMany({ where: { coachId } });
    }),
);
const slotSchema = z
  .object({
    name: z.string().min(1),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((v) => v.endMinute > v.startMinute);
route("get", "/slots", [staff], () =>
  prisma.slot.findMany({ orderBy: { startMinute: "asc" } }),
);
route("post", "/slots", [staff, validate(slotSchema)], (req) =>
  prisma.slot.create({ data: { ...req.body, facilityId: facility() } }),
);
route("get", "/schedule-patterns", [staff], () =>
  prisma.schedulePattern.findMany({ include: { slot: true, class: true } }),
);
route(
  "post",
  "/schedule-patterns",
  [
    staff,
    validate(
      z.object({
        classId: z.string(),
        roomId: z.string(),
        slotId: z.string(),
        weekdays: z.array(z.number().int().min(1).max(7)).min(1),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    ),
  ],
  (req) =>
    prisma.$transaction(
      async (tx) => {
        const facilityRow = await tx.facility.findUnique({
          where: { id: facility() },
        });
        if (facilityRow?.timezone !== "Asia/Ho_Chi_Minh")
          throw new AppError(
            "Scheduler currently supports Asia/Ho_Chi_Minh",
            400,
          );
        const slot = await tx.slot.findUnique({
          where: { id: req.body.slotId },
        });
        if (!slot) throw new AppError("Slot not found", 404);
        let sessions;
        try {
          sessions = expandPattern(
            req.body.startDate,
            req.body.endDate,
            req.body.weekdays,
            slot.startMinute,
            slot.endMinute,
          );
        } catch {
          throw new AppError("Invalid schedule pattern", 400);
        }
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"pattern:" + req.body.classId}))`;
        const pattern = await tx.schedulePattern.create({
          data: {
            ...req.body,
            facilityId: facility(),
            startDate: new Date(req.body.startDate + "T00:00:00+07:00"),
            endDate: new Date(req.body.endDate + "T00:00:00+07:00"),
          },
        });
        for (const session of sessions)
          await createSchedule({
            ...session,
            classId: req.body.classId,
            roomId: req.body.roomId,
          });
        return { ...pattern, sessionsCreated: sessions.length };
      },
      { timeout: 30000 },
    ),
);

const interval = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    reason: z.string().min(3).max(1000),
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime));
route(
  "get",
  "/leave-requests",
  [authorize("ADMIN", "MANAGER", "COACH", "RECEPTIONIST")],
  async (req) => {
    const coach =
      req.user.role === "COACH"
        ? await prisma.coachProfile.findUnique({
            where: { userId: req.user.id },
          })
        : null;
    if (req.user.role === "COACH" && !coach)
      throw new AppError("Coach not found", 404);
    const requests = await prisma.leaveRequest.findMany({
      where: coach
        ? { coachId: coach.id }
        : req.user.role === "RECEPTIONIST"
          ? { requesterId: req.user.id }
          : {},
      orderBy: { createdAt: "desc" },
    });
    return withRequesters(requests);
  },
);
route(
  "post",
  "/leave-requests",
  [authorizeExact("COACH", "RECEPTIONIST"), validate(interval)],
  (req) => createStaffLeave(req.user, req.body),
);
const decision = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().min(3),
  resolutions: z
    .array(
      z.object({
        scheduleId: z.string(),
        action: z.enum(["REPLACE", "MOVE", "CANCEL"]),
        coachId: z.string().optional(),
        roomId: z.string().optional(),
        startTime: z.string().datetime().optional(),
        endTime: z.string().datetime().optional(),
      }),
    )
    .default([]),
});
route("patch", "/leave-requests/:id", [staff, validate(decision)], (req) =>
  prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"leave:" + id(req)}))`;
      const leave = await tx.leaveRequest.findUnique({
        where: { id: id(req) },
      });
      if (!leave || leave.status !== "PENDING")
        throw new AppError("Pending leave not found", 409);
      const coachId = leave.coachId;
      if (!coachId && req.body.resolutions.length)
        throw new AppError(
          "Non-coach leave cannot change class schedules",
          400,
        );
      if (req.body.status === "APPROVED" && coachId) {
        const loadAffected = () =>
          requestContext.run(
            { ...requestContext.getStore(), facilityId: undefined },
            () =>
              tx.classSchedule.findMany({
                where: {
                  status: "SCHEDULED",
                  startTime: { lt: leave.endTime },
                  endTime: { gt: leave.startTime },
                  OR: [
                    { coachId: coachId },
                    {
                      coachId: null,
                      class: { coaches: { some: { coachId: coachId } } },
                    },
                  ],
                },
                include: { class: { include: { coaches: true } } },
              }),
          );
        const initial = await loadAffected();
        if (
          req.user.role !== "ADMIN" &&
          initial.some((s) => s.class.facilityId !== facility())
        )
          throw new AppError(
            "LEAVE_HAS_SESSIONS_AT_OTHER_FACILITIES: ADMIN must coordinate this leave",
            409,
          );
        for (const scheduleId of initial.map((s) => s.id).sort())
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('enrollment:schedule:' || ${scheduleId}::text))`;
        const rooms = [
          ...new Set([
            ...initial.map((s) => s.roomId),
            ...req.body.resolutions.map((r: any) => r.roomId).filter(Boolean),
          ]),
        ].sort() as string[];
        for (const roomId of rooms)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schedule:room:' || ${roomId}::text))`;
        const coaches = [
          ...new Set([
            coachId,
            ...initial.flatMap((s) => s.class.coaches.map((c) => c.coachId)),
            ...req.body.resolutions.map((r: any) => r.coachId).filter(Boolean),
          ]),
        ].sort() as string[];
        for (const coachId of coaches)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schedule:coach:' || ${coachId}::text))`;
        const affected = await loadAffected();
        const resolutions = req.body.resolutions;
        if (
          new Set(resolutions.map((v: any) => v.scheduleId)).size !==
            affected.length ||
          resolutions.length !== affected.length ||
          affected.some(
            (s) => !resolutions.some((v: any) => v.scheduleId === s.id),
          )
        )
          throw new AppError("LEAVE_RESOLUTION_REQUIRED", 409, {
            sessions: affected.map((s) => s.id),
          });
        for (const r of resolutions) {
          const sessionFacility = affected.find((s) => s.id === r.scheduleId)!
            .class.facilityId;
          await requestContext.run(
            { ...requestContext.getStore(), facilityId: sessionFacility },
            async () => {
              if (r.action === "REPLACE") {
                if (!r.coachId || r.coachId === coachId)
                  throw new AppError("Replacement coach required", 400);
                await updateSchedule(r.scheduleId, {
                  coachId: r.coachId,
                  reason: req.body.reason,
                });
              } else if (r.action === "MOVE") {
                if (
                  !r.startTime ||
                  !r.endTime ||
                  (new Date(r.startTime) < leave.endTime &&
                    new Date(r.endTime) > leave.startTime)
                )
                  throw new AppError(
                    "Move session outside leave interval",
                    400,
                  );
                await updateSchedule(r.scheduleId, {
                  startTime: r.startTime,
                  endTime: r.endTime,
                  roomId: r.roomId,
                  reason: req.body.reason,
                });
              } else
                await updateSchedule(r.scheduleId, {
                  status: "CANCELLED",
                  reason: req.body.reason,
                });
            },
          );
        }
      }
      return tx.leaveRequest.update({
        where: { id: id(req) },
        data: {
          status: req.body.status,
          decisionReason: req.body.reason,
          decidedBy: actor(),
          decidedAt: new Date(),
        },
      });
    },
    { timeout: 30000 },
  ),
);

route(
  "get",
  "/issues",
  [authorize("MEMBER", "COACH", "MANAGER", "RECEPTIONIST", "ADMIN")],
  async (req) =>
    withRequesters(
      await prisma.issue.findMany({
        where: issueOwner(req.user),
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
);
route(
  "post",
  "/issues",
  [
    authorize("MEMBER", "COACH", "RECEPTIONIST", "MANAGER"),
    validate(
      z.object({
        title: z.string().min(3).max(120),
        description: z.string().min(5).max(3000),
      }),
    ),
  ],
  (req) => {
    if (readAttendanceReport(req.body.description)) throw new AppError("Báo cáo chuyên cần phải được tạo qua luồng chuyên cần", 400);
    return prisma.issue.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        memberId: req.user.role === "MEMBER" ? actor() : null,
        requesterId: actor(),
        requesterRole: req.user.role,
        facilityId: facility(),
      },
    });
  },
);
route(
  "patch",
  "/issues/:id",
  [
    authorize("ADMIN", "MANAGER", "RECEPTIONIST"),
    validate(
      z.object({
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
        response: z.string().min(3).max(3000),
      }),
    ),
  ],
  async (req) => {
    const issue = await prisma.issue.findUnique({ where: { id: id(req) } });
    if (issue && readAttendanceReport(issue.description)) throw new AppError("Báo cáo chuyên cần phải được quản lý duyệt qua luồng chuyên cần", 403);
    return prisma.issue.update({ where: { id: id(req) }, data: { ...req.body, resolvedBy: actor() } });
  },
);
route("get", "/audit-logs", [staff], (req) =>
  getAuditFeed(req.user.role, req.query),
);
route(
  "get",
  "/issues/:id",
  [authorize("MEMBER", "COACH", "MANAGER", "RECEPTIONIST", "ADMIN")],
  async (req) => {
    const issue = await prisma.issue.findFirst({
      where: {
        id: id(req),
        ...issueOwner(req.user),
      },
    });
    if (!issue) throw new AppError("Issue not found", 404);
    return issue;
  },
);
route(
  "put",
  "/issues/:id",
  [
    authorize("MEMBER"),
    validate(
      z.object({
        title: z.string().min(3).max(120),
        description: z.string().min(5).max(3000),
      }),
    ),
  ],
  async (req) => {
    const issue = await prisma.issue.findFirst({
      where: { id: id(req), memberId: actor(), status: "OPEN" },
    });
    if (!issue) throw new AppError("Open issue not found", 404);
    if (readAttendanceReport(issue.description) || readAttendanceReport(req.body.description)) throw new AppError("Không được sửa báo cáo chuyên cần qua yêu cầu hỗ trợ", 403);
    return prisma.issue.update({ where: { id: issue.id }, data: req.body });
  },
);
route("delete", "/issues/:id", [authorize("MEMBER")], async (req) => {
  const issue = await prisma.issue.findFirst({
    where: { id: id(req), memberId: actor(), status: "OPEN" },
  });
  if (!issue) throw new AppError("Open issue not found", 404);
  if (readAttendanceReport(issue.description)) throw new AppError("Không được xóa báo cáo chuyên cần", 403);
  return prisma.issue.delete({ where: { id: issue.id } });
});
const cashier = authorizeExact("RECEPTIONIST");
route("get", "/counter-orders", [cashier], () =>
  prisma.payment.findMany({
    where: { gateway: null, planId: { not: null } },
    include: { member: { include: { user: { select: { fullName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  }),
);
route(
  "post",
  "/counter-orders",
  [
    cashier,
    validate(
      z.object({
        memberId: z.string().min(1),
        planId: z.string().min(1),
        method: z.enum(["CASH", "BANK_TRANSFER"]),
        note: z.string().optional(),
      }),
    ),
  ],
  async (req) => {
    const member = await prisma.memberProfile.findFirst({
      where: { OR: [{ id: req.body.memberId }, { userId: req.body.memberId }] },
      include: { user: true },
    });
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: req.body.planId },
    });
    if (
      !member?.user.isActive ||
      member.user.role !== "MEMBER" ||
      !plan?.isActive ||
      plan.tier === "FREE"
    )
      throw new AppError("Invalid member or paid plan", 400);
    return prisma.payment.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        amount: plan.price,
        method: req.body.method,
        status: "PENDING",
        note: req.body.note,
        createdById: actor(),
        planNameSnapshot: plan.name,
        planTierSnapshot: plan.tier,
        durationDaysSnapshot: plan.durationDays,
        maxConcurrentClassesSnapshot: plan.maxConcurrentClasses,
      },
    });
  },
);
route(
  "post",
  "/counter-orders/:id/confirm",
  [cashier, validate(z.object({ reason: z.string().min(3).max(1000) }))],
  (req) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"payment:" + id(req)}))`;
      const payment = await tx.payment.findUnique({
        where: { id: id(req) },
        include: { member: { include: { user: true } }, plan: true },
      });
      if (!payment || payment.gateway || !payment.plan)
        throw new AppError("Counter order not found", 404);
      if (payment.status === "SUCCESS" && payment.subscriptionId)
        return payment;
      if (payment.status !== "PENDING" || !payment.member.user.isActive)
        throw new AppError("Order cannot be confirmed", 409);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"member-subscription:" + payment.memberId}))`;
      return activateSubscriptionForPayment(tx, {
        memberProfileId: payment.memberId,
        memberUserId: payment.member.userId,
        memberName: payment.member.user.fullName,
        plan: payment.plan,
        paymentId: payment.id,
        optionSnapshot: {
          planName: payment.planNameSnapshot,
          tier: payment.planTierSnapshot,
          durationDays: payment.durationDaysSnapshot,
          maxConcurrentClasses: payment.maxConcurrentClassesSnapshot,
        },
      });
    }),
);
export default router;
