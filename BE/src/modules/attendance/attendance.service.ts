import { prisma } from "../../config/prisma.js";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler.js";

async function verifyCoachAccess(scheduleId: string, user: any) {
  if (user.role === "MANAGER" || user.role === "STAFF") return true;

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { class: { include: { coaches: true } } },
  });
  if (!schedule) throw new AppError("Schedule not found", 404);

  if (user.role === "COACH") {
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: user.id } });
    if (!coachProfile) throw new AppError("Coach profile not found", 404);
    
    const isAssigned = schedule.class.coaches.some(c => c.coachId === coachProfile.id);
    if (!isAssigned) throw new AppError("Forbidden: You are not assigned to this class", 403);
  }
}

export const createAttendance = async (data: Prisma.AttendanceUncheckedCreateInput, user: any) => {
  await verifyCoachAccess(data.scheduleId, user);

  // Verify member is enrolled
  const enrollment = await prisma.enrollment.findUnique({
    where: { memberId_scheduleId: { memberId: data.memberId, scheduleId: data.scheduleId } },
  });
  if (!enrollment || (enrollment.status !== "BOOKED" && enrollment.status !== "COMPLETED")) {
    throw new AppError("Member is not actively enrolled in this schedule", 400);
  }

  return prisma.attendance.create({ data });
};

export const getAttendancesBySchedule = async (scheduleId: string) => {
  return prisma.attendance.findMany({ where: { scheduleId }, include: { member: { include: { user: true } } } });
};

export const updateAttendance = async (id: string, data: Prisma.AttendanceUpdateInput, user: any) => {
  const attendance = await prisma.attendance.findUnique({ where: { id } });
  if (!attendance) throw new AppError("Attendance not found", 404);

  await verifyCoachAccess(attendance.scheduleId, user);
  return prisma.attendance.update({ where: { id }, data });
};