import { prisma } from "../../config/prisma.js";
import { Prisma } from "@prisma/client";

export const createAttendance = async (data: Prisma.AttendanceUncheckedCreateInput) => {
  return prisma.attendance.create({ data });
};

export const getAttendancesBySchedule = async (scheduleId: string) => {
  return prisma.attendance.findMany({ where: { scheduleId }, include: { member: { include: { user: true } } } });
};

export const updateAttendance = async (id: string, data: Prisma.AttendanceUpdateInput) => {
  return prisma.attendance.update({ where: { id }, data });
};