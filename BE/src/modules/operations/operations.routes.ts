import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { checkFacilityScope } from "../../middlewares/facilityScope.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { expandPattern } from "./rules.js";
import { activateSubscriptionForPayment } from "../subscriptions/subscription-purchase.service.js";
import { validateResources } from "./scheduling.js";
import {
  createSchedule,
  updateSchedule,
} from "../class-schedules/class-schedules.service.js";
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
  prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        in:
          req.user.role === "ADMIN"
            ? ["COACH", "RECEPTIONIST", "MANAGER"]
            : ["COACH", "RECEPTIONIST"],
      },
    },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  }),
);
route("get", "/coaches/:id/specializations", [], (req) =>
  prisma.coachSpecialization.findMany({ where: { coachId: id(req) } }),
);
route("get", "/leave-requests/:id/affected", [staff], async (req) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: id(req) },
  });
  if (!leave) throw new AppError("Leave not found", 404);
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
            { coachId: leave.coachId },
            {
              coachId: null,
              class: { coaches: { some: { coachId: leave.coachId } } },
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
    authorize("ADMIN"),
    validate(z.object({ sportIds: z.array(z.string()).min(1) })),
  ],
  (req) =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.coachProfile.findUnique({ where: { id: id(req) } })))
        throw new AppError("Coach not found", 404);
      await tx.coachSpecialization.deleteMany({ where: { coachId: id(req) } });
      await tx.coachSpecialization.createMany({
        data: [...new Set<string>(req.body.sportIds)].map((sportId) => ({
          coachId: id(req),
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
                { coachId: id(req) },
                {
                  coachId: null,
                  class: { coaches: { some: { coachId: id(req) } } },
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
      return tx.coachSpecialization.findMany({ where: { coachId: id(req) } });
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
  [authorize("ADMIN", "MANAGER", "COACH")],
  async (req) => {
    const coach =
      req.user.role === "COACH"
        ? await prisma.coachProfile.findUnique({
            where: { userId: req.user.id },
          })
        : null;
    if (req.user.role === "COACH" && !coach)
      throw new AppError("Coach not found", 404);
    return prisma.leaveRequest.findMany({
      where: coach ? { coachId: coach.id } : {},
      orderBy: { createdAt: "desc" },
    });
  },
);
route(
  "post",
  "/leave-requests",
  [authorize("COACH"), validate(interval)],
  async (req) => {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!coach) throw new AppError("Coach not found", 404);
    return prisma.leaveRequest.create({
      data: {
        ...req.body,
        coachId: coach.id,
        facilityId: facility(),
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
      },
    });
  },
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
      if (req.body.status === "APPROVED") {
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
                    { coachId: leave.coachId },
                    {
                      coachId: null,
                      class: { coaches: { some: { coachId: leave.coachId } } },
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
            leave.coachId,
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
                if (!r.coachId || r.coachId === leave.coachId)
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
  [authorize("MEMBER", "MANAGER", "RECEPTIONIST", "ADMIN")],
  (req) =>
    prisma.issue.findMany({
      where: req.user.role === "MEMBER" ? { memberId: actor() } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
);
route(
  "post",
  "/issues",
  [
    authorize("MEMBER"),
    validate(
      z.object({
        title: z.string().min(3).max(120),
        description: z.string().min(5).max(3000),
      }),
    ),
  ],
  (req) =>
    prisma.issue.create({
      data: { ...req.body, memberId: actor(), facilityId: facility() },
    }),
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
  (req) =>
    prisma.issue.update({
      where: { id: id(req) },
      data: { ...req.body, resolvedBy: actor() },
    }),
);
route("get", "/audit-logs", [staff], (req) =>
  prisma.auditLog.findMany({
    take: 100,
    skip: Math.max(0, Number(req.query.skip) || 0),
    orderBy: { createdAt: "desc" },
  }),
);
route(
  "get",
  "/issues/:id",
  [authorize("MEMBER", "MANAGER", "RECEPTIONIST", "ADMIN")],
  async (req) => {
    const issue = await prisma.issue.findFirst({
      where: {
        id: id(req),
        ...(req.user.role === "MEMBER" ? { memberId: actor() } : {}),
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
    return prisma.issue.update({ where: { id: issue.id }, data: req.body });
  },
);
route("delete", "/issues/:id", [authorize("MEMBER")], async (req) => {
  const issue = await prisma.issue.findFirst({
    where: { id: id(req), memberId: actor(), status: "OPEN" },
  });
  if (!issue) throw new AppError("Open issue not found", 404);
  return prisma.issue.delete({ where: { id: issue.id } });
});
const cashier = authorize("ADMIN", "MANAGER", "RECEPTIONIST");
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
