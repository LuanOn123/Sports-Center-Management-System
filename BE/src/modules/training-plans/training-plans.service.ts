import { prisma } from "../../config/prisma.js";
import { Prisma } from "@prisma/client";

export const createPlan = async (data: Prisma.TrainingPlanUncheckedCreateInput) => {
  return prisma.trainingPlan.create({ data });
};

export const getPlans = async (memberId?: string) => {
  return prisma.trainingPlan.findMany({ 
    where: memberId ? { memberId } : undefined,
    include: { coach: { include: { user: true } }, results: true }
  });
};

export const createResult = async (data: Prisma.TrainingResultUncheckedCreateInput) => {
  return prisma.trainingResult.create({ data });
};