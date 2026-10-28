import { requestContext } from "../../config/request-context.js";
import { mergeRequirements, missingCapabilities } from "../operations/rules.js";
import { validateResources } from "../operations/scheduling.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";

export async function listSports(query: any) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (query.isActive !== undefined) where.isActive = query.isActive === "true";
  if (query.search)
    where.name = { contains: query.search, mode: "insensitive" };
  if (query.areaType) where.areaTypes = { has: query.areaType };

  const [total, sports] = await Promise.all([
    prisma.sport.count({ where }),
    prisma.sport.findMany({
      where,
      skip,
      take: limit,
      include: { requirements: true, _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return { sports, pagination: buildPaginationMeta(total, page, limit) };
}

export async function createSport(data: any) {
  const existing = await prisma.sport.findUnique({
    where: { name: data.name },
  });
  if (existing) throw new AppError("Sport with this name already exists", 409);
  const { requirements, ...fields } = data;
  return prisma.sport.create({ data: { ...fields, requirements: requirements ? {
    create: Object.entries(requirements).map(([key, minimum]) => ({ key, minimum: minimum as number })),
  } : undefined }, include: { requirements: true } });
}

export async function getSportById(id: string) {
  const sport = await prisma.sport.findUnique({
    where: { id },
    include: {
      requirements: true,
      classes: { where: { isActive: true }, take: 10 },
    },
  });
  if (!sport) throw new AppError("Sport not found", 404);
  return sport;
}

export async function updateSport(id: string, data: any) {
  const sport = await prisma.sport.findUnique({
    where: { id },
    include: { requirements: true },
  });
  if (!sport) throw new AppError("Sport not found", 404);

  if (data.isActive === false && sport.isActive === true) {
    const activeClasses = await prisma.class.count({
      where: { sports: { some: { id } }, isActive: true },
    });
    if (activeClasses > 0)
      throw new AppError("Cannot deactivate sport with active classes", 400);
  }

  // Không được thu hẹp areaTypes nếu đang làm một Class active trở nên invalid.
  if (data.areaTypes) {
    const removed = (sport.areaTypes as string[]).filter(
      (t) => !(data.areaTypes as string[]).includes(t),
    );
    if (removed.length > 0) {
      const affected = await prisma.class.findFirst({
        where: {
          sports: { some: { id } },
          isActive: true,
          areaType: { in: removed as any },
        },
        select: { id: true, name: true, areaType: true },
      });
      if (affected) {
        throw new AppError(
          `Cannot remove area type "${affected.areaType}" from Sport "${sport.name}" because it is used by Class "${affected.name}"`,
          400,
        );
      }
    }
  }

  const { requirements, ...fields } = data;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.sport.update({ where: { id }, data: { ...fields,
      ...(requirements !== undefined ? { requirements: { deleteMany: {}, create:
        Object.entries(requirements).map(([key, minimum]) => ({ key, minimum: minimum as number })) } } : {}),
    }, include: { requirements: true } });
    if (requirements !== undefined) {
      // Sports are global: edits must remain valid at every facility, including
      // default rooms of classes which do not have a scheduled session yet.
      await requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, async () => {
        const classes = await tx.class.findMany({
          where: { sports: { some: { id } }, isActive: true },
          include: { defaultRoom: { include: { capabilities: true } }, sports: { include: { requirements: true } } },
        });
        for (const cls of classes) {
          const required = mergeRequirements(cls.sports.flatMap((sport) => sport.requirements));
          if (cls.defaultRoom && missingCapabilities(required, cls.defaultRoom.capabilities, cls.defaultRoom.areaType).length)
            throw new AppError(`Phòng mặc định của lớp "${cls.name}" không đủ dụng cụ theo yêu cầu mới.`, 409);
        }
        const sessions = await tx.classSchedule.findMany({ where: { class: { sports: { some: { id } } }, status: "SCHEDULED", endTime: { gt: new Date() } } });
        for (const session of sessions)
          await validateResources(tx, session.roomId, session.classId, session.startTime, session.endTime, session.coachId ?? undefined);
      });
    }
    return updated;
  }, { timeout: 30000 });
}

export async function deleteSport(id: string) {
  const sport = await prisma.sport.findUnique({ where: { id } });
  if (!sport) throw new AppError("Sport not found", 404);
  const activeClasses = await prisma.class.count({
    where: { sports: { some: { id } }, isActive: true },
  });
  if (activeClasses > 0)
    throw new AppError("Cannot deactivate sport with active classes", 400);
  return prisma.sport.update({ where: { id }, data: { isActive: false } });
}
