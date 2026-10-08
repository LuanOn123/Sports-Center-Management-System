import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { User } from "../../models/User.js";
import { AppError } from "../../middlewares/errorHandler.js";

export async function assignFacilityManager(
  facilityId: string,
  userId: string,
  replacedUserId?: string,
) {
  const user = await User.findById(userId).lean();
  if (!user || !user.isActive || user.role !== "MANAGER")
    throw new AppError("Hãy chọn một quản lý đang hoạt động", 400);
  if (replacedUserId === userId)
    throw new AppError("Hãy chọn quản lý mới khác người đang phụ trách", 400);
  return prisma.$transaction(async (tx) => {
    for (const lockedId of [
      ...new Set(
        [userId, replacedUserId].filter((id): id is string => Boolean(id)),
      ),
    ].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('facility-manager:' || ${lockedId}::text))`;
    }
    const target = await tx.facility.findUnique({ where: { id: facilityId } });
    if (!target?.isActive)
      throw new AppError("Cơ sở không tồn tại hoặc đã ngừng hoạt động", 400);
    const existing = await requestContext.run(
      { ...requestContext.getStore(), facilityId: undefined },
      () =>
        tx.facilityStaff.findFirst({
          where: { userId, role: "MANAGER", isActive: true },
        }),
    );
    if (existing)
      throw new AppError(
        "Quản lý này đã được gán vào một cơ sở. Hãy gỡ phân công trước khi gán lại.",
        409,
      );
    return requestContext.run(
      { ...requestContext.getStore(), facilityId },
      async () => {
        if (replacedUserId) {
          const changed = await tx.facilityStaff.updateMany({
            where: {
              facilityId,
              userId: replacedUserId,
              role: "MANAGER",
              isActive: true,
            },
            data: { isActive: false },
          });
          if (changed.count !== 1)
            throw new AppError(
              "Phân công cũ đã thay đổi. Vui lòng tải lại danh sách.",
              409,
            );
        }
        return tx.facilityStaff.upsert({
          where: {
            userId_facilityId_role: { userId, facilityId, role: "MANAGER" },
          },
          update: { isActive: true },
          create: { userId, facilityId, role: "MANAGER" },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        });
      },
    );
  });
}
