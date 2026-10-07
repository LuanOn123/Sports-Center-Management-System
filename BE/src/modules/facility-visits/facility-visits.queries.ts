import { buildPaginationMeta } from "../../utils/pagination.js";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { resolveMemberProfile } from "./facility-visits.service.js";

/** Lịch sử vào cửa của CHÍNH hội viên — GLOBAL (mọi cơ sở). */
export async function getMyVisits(userId: string, query: any) {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!memberProfile) throw new AppError("Member profile not found", 404);

  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = { memberId: memberProfile.id };
  if (query.from || query.to) {
    where.checkInAt = {};
    if (query.from) where.checkInAt.gte = new Date(query.from);
    if (query.to) where.checkInAt.lte = new Date(query.to);
  }

  const [total, visits] = await requestContext.run(
    { ...requestContext.getStore(), facilityId: undefined },
    () =>
      Promise.all([
        prisma.facilityVisit.count({ where }),
        prisma.facilityVisit.findMany({
          where,
          skip,
          take: limit,
          include: {
            facility: { select: { id: true, name: true, code: true } },
          },
          orderBy: { checkInAt: "desc" },
        }),
      ]),
  );
  return { visits, pagination: buildPaginationMeta(total, page, limit) };
}

/** Danh sách lượt vào cửa vận hành — FACILITY-SCOPED qua DAL. */
export async function listVisits(query: any) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (query.memberId) {
    const profile = await resolveMemberProfile(prisma, query.memberId);
    where.memberId = profile.id;
  }
  if (query.from || query.to) {
    where.checkInAt = {};
    if (query.from) where.checkInAt.gte = new Date(query.from);
    if (query.to) where.checkInAt.lte = new Date(query.to);
  }

  const [total, visits] = await Promise.all([
    prisma.facilityVisit.count({ where }),
    prisma.facilityVisit.findMany({
      where,
      skip,
      take: limit,
      include: {
        member: { include: { user: { select: { fullName: true, email: true } } } },
        facility: { select: { id: true, name: true, code: true } },
      },
      orderBy: { checkInAt: "desc" },
    }),
  ]);
  return { visits, pagination: buildPaginationMeta(total, page, limit) };
}
