import { PrismaClient } from "@prisma/client";
import { requestContext } from "./request-context.js";
import { facilityFilter, facilityRoots, parents } from "./scoped-data.js";
import { AppError } from "../middlewares/errorHandler.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export let prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const transact = prisma.$transaction.bind(prisma);
(prisma as any).$transaction = (callback: any, options?: any) => {
  if (typeof callback !== "function") return transact(callback, options);
  const context = requestContext.getStore();
  if (context?.transaction) return callback(context.transaction);
  return transact(
    (tx) => {
      const bound = bindContext(tx);
      return requestContext.run({ ...context, transaction: bound }, () =>
        callback(bound),
      );
    },
    { maxWait: 10000, timeout: 30000, ...options },
  );
};
const audited = new Set([
  "MembershipPlan",
  // MF-09: audit thao tác trên membership (cấp/gia hạn/tạm dừng/hủy). Ghi kèm facility context
  // hiện tại nên dòng AuditLog rơi vào nhật ký của cơ sở đang thao tác ("ai đã làm gì, ở đâu").
  // Write nằm trong transaction (mua/gia hạn/hủy) được ghi cùng transaction → rollback cùng nhau.
  "MembershipSubscription",
  "ClassSchedule",
  "Room",
  "Class",
  "Payment",
  "Attendance",
  "LeaveRequest",
  "Issue",
  "FacilityStaff",
  "SubjectRequirement",
  "RoomCapability",
  "ClassMember",
  "CoachSpecialization",
]);
const writes = new Set([
  "create",
  "update",
  "upsert",
  "delete",
  "createMany",
  "updateMany",
  "deleteMany",
]);
const argsPlaceholder = (params: any) => params.args?.where;
const json = (value: any) =>
  value == null ? undefined : JSON.parse(JSON.stringify(value));
prisma.$use(async (params, next) => {
  const context = requestContext.getStore();
  const model = params.model || "";
  if (context?.transaction && !params.runInTransaction && model)
    return (context.transaction as any)[
      model[0].toLowerCase() + model.slice(1)
    ][params.action](params.args);
  const isWrite = writes.has(params.action);
  const shouldAudit =
    context?.actorId && context.facilityId && audited.has(model) && isWrite;
  // Audit rows and mutations commit/rollback together, including legacy single writes.
  if (shouldAudit && !params.runInTransaction) {
    return prisma.$transaction((tx: any) =>
      tx[model[0].toLowerCase() + model.slice(1)][params.action](params.args),
    );
  }
  const db: any = context?.transaction || prisma;
  if (
    context?.facilityId &&
    typeof argsPlaceholder(params)?.id === "string" &&
    (facilityRoots.has(model) || parents[model])
  ) {
    const chain = parents[model] || [];
    const select = chain.reduceRight(
      (nested, key) => ({ [key]: { select: nested } }),
      { facilityId: true } as any,
    );
    const row = await requestContext.run(
      { ...context, facilityId: undefined, actorId: undefined },
      () =>
        db[model[0].toLowerCase() + model.slice(1)].findUnique({
          where: { id: params.args.where.id },
          select,
        }),
    );
    const owner = chain.reduce((nested, key) => nested?.[key], row);
    if (owner && owner.facilityId !== context.facilityId)
      throw new AppError("FORBIDDEN_SCOPE", 403);
  }
  const predicate = context?.facilityId
    ? facilityFilter(model, context.facilityId)
    : undefined;
  const args: any = (params.args ||= {});
  if (predicate) {
    if (args.where || !["create", "createMany"].includes(params.action))
      args.where = {
        ...args.where,
        AND: [
          ...(Array.isArray(args.where?.AND)
            ? args.where.AND
            : args.where?.AND
              ? [args.where.AND]
              : []),
          predicate,
        ],
      };
    if (isWrite && facilityRoots.has(model)) {
      for (const data of [args.data, args.create, args.update]
        .flat()
        .filter(Boolean)) {
        if (data.facilityId && data.facilityId !== context!.facilityId)
          throw new AppError("FORBIDDEN_SCOPE", 403);
        data.facilityId = context!.facilityId;
      }
    }
    if (isWrite) {
      for (const data of [args.data, args.create, args.update]
        .flat()
        .filter(Boolean)) {
        for (const [field, delegate] of Object.entries({
          classId: "class",
          roomId: "room",
          scheduleId: "classSchedule",
          subscriptionId: "membershipSubscription",
          paymentId: "payment",
          slotId: "slot",
        })) {
          if (
            typeof data[field] === "string" &&
            !(await db[delegate].findFirst({ where: { id: data[field] } }))
          )
            throw new AppError("FORBIDDEN_SCOPE", 403);
        }
      }
    }
  }
  if (model === "Class" && params.action === "create") {
    const connected = [args.data.sports?.connect].flat().filter(Boolean);
    const requirements = await db.subjectRequirement.findMany({
      where: { sportId: { in: connected.map((v: any) => v.id) } },
    });
    args.data.requirementsSnapshot = Object.fromEntries(
      requirements.map((r: any) => [
        r.key,
        Math.max(
          r.minimum,
          ...requirements
            .filter((v: any) => v.key === r.key)
            .map((v: any) => v.minimum),
        ),
      ]),
    );
  }
  let before;
  if (
    shouldAudit &&
    args.where &&
    !["create", "createMany"].includes(params.action)
  )
    before = ["update", "delete", "upsert"].includes(params.action)
      ? await db[model[0].toLowerCase() + model.slice(1)].findUnique({
          where: args.where,
        })
      : await db[model[0].toLowerCase() + model.slice(1)].findMany({
          where: args.where,
        });
  const result = await next(params);
  let auditAfter = result;
  if (
    shouldAudit &&
    ["updateMany", "deleteMany"].includes(params.action) &&
    Array.isArray(before)
  )
    auditAfter =
      params.action === "deleteMany"
        ? null
        : await db[model[0].toLowerCase() + model.slice(1)].findMany({
            where: { id: { in: before.map((row: any) => row.id) } },
          });
  if (shouldAudit && params.action === "createMany") auditAfter = args.data;
  if (
    context?.facilityId &&
    isWrite &&
    ["Room", "Class", "ClassMember", "CoachSpecialization"].includes(model)
  ) {
    const { checkScheduleConflicts } =
      await import("../modules/class-schedules/class-schedules.service.js");
    const related =
      model === "Room"
        ? { roomId: result.id }
        : model === "Class"
          ? { classId: result.id }
          : model === "ClassMember"
            ? {
                classId: result.classId || args.where?.classId_coachId?.classId,
              }
            : {
                OR: [
                  { coachId: result.coachId },
                  {
                    coachId: null,
                    class: { coaches: { some: { coachId: result.coachId } } },
                  },
                ],
              };
    if (!["createMany", "deleteMany", "updateMany"].includes(params.action)) {
      const upcoming = await db.classSchedule.findMany({
        where: { ...related, status: "SCHEDULED", endTime: { gt: new Date() } },
      });
      for (const session of upcoming)
        await checkScheduleConflicts(
          db,
          session.roomId,
          session.classId,
          session.startTime,
          session.endTime,
          session.id,
          session.coachId || undefined,
        );
    }
  }
  if (shouldAudit)
    await db.auditLog.create({
      data: {
        facilityId: context!.facilityId!,
        actorId: context!.actorId!,
        entity: model,
        entityId: result?.id,
        action: params.action,
        before: json(before),
        after: json(auditAfter),
        reason: context?.reason,
      },
    });
  return result;
});

// Prisma delegates return lazy promises. Start each query inside the request's context,
// even when a service returns it directly and Express consumes the promise later.
function bindContext<T extends object>(client: T): T {
  const delegates = new Map<PropertyKey, any>();
  return new Proxy(client, {
    get(target: any, key) {
      const value = Reflect.get(target, key);
      if (
        typeof key !== "string" ||
        key.startsWith("$") ||
        !value ||
        typeof value !== "object" ||
        typeof value.findMany !== "function"
      )
        return typeof value === "function" ? value.bind(target) : value;
      if (!delegates.has(key))
        delegates.set(
          key,
          new Proxy(value, {
            get(delegate, action) {
              const operation = Reflect.get(delegate, action);
              if (typeof operation !== "function") return operation;
              return (...args: any[]) => {
                const captured = requestContext.getStore();
                return requestContext.run(
                  captured || {},
                  async () => await operation.apply(delegate, args),
                );
              };
            },
          }),
        );
      return delegates.get(key);
    },
  });
}
prisma = bindContext(prisma);
