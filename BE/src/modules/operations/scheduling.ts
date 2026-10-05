import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { missingCapabilities } from "./rules.js";

export async function validateResources(
  db: any,
  roomId: string,
  classId: string,
  startTime: Date,
  endTime: Date,
  replacement?: string,
) {
  const cls = await db.class.findUnique({
    where: { id: classId },
    include: { sports: true, coaches: true },
  });
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { capabilities: true },
  });
  if (!cls?.isActive || !room?.isActive || cls.facilityId !== room.facilityId)
    throw new AppError("Invalid facility resources", 400);
  if (room.capacity < cls.capacity || room.areaType !== cls.areaType)
    throw new AppError("Room capacity or area is unsuitable", 400);
  const missing = missingCapabilities(
    cls.requirementsSnapshot as Record<string, number>,
    room.capabilities,
  );
  if (missing.length)
    throw new AppError(`ROOM_CAPABILITY_MISSING: ${missing.join(", ")}`, 409);
  const coaches = replacement
    ? [replacement]
    : cls.coaches.map((v: any) => v.coachId);
  if (!coaches.length) throw new AppError("COACH_REQUIRED", 409);
  for (const coachId of coaches) {
    const coach = await db.coachProfile.findUnique({
      where: { id: coachId },
      include: { user: true, specializations: true },
    });
    if (
      !coach?.user.isActive ||
      !(await db.facilityStaff.findFirst({
        where: {
          userId: coach.userId,
          facilityId: cls.facilityId,
          role: "COACH",
          isActive: true,
        },
      }))
    )
      throw new AppError("COACH_NOT_ASSIGNED", 409);
    if (
      cls.sports.some(
        (s: any) => !coach.specializations.some((v: any) => v.sportId === s.id),
      )
    )
      throw new AppError("COACH_SPECIALIZATION_REQUIRED", 409);
    const leave = await requestContext.run(
      { ...requestContext.getStore(), facilityId: undefined },
      () =>
        db.leaveRequest.findFirst({
          where: {
            coachId,
            status: "APPROVED",
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        }),
    );
    if (leave) throw new AppError("COACH_ON_LEAVE", 409);
  }
}
