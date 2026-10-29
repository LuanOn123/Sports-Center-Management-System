import { createUser } from "../users/users.service.js";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  CreateFacilitySchema,
  UpdateFacilitySchema,
  AssignStaffSchema,
  CreateFacilityCoachSchema,
  CreateFacilityReceptionistSchema,
} from "./facilities.schema.js";
import { User } from "../../models/User.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { hashPassword } from "../../utils/bcrypt.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { Prisma } from "@prisma/client";
import { assignFacilityManager } from "./facility-manager.service.js";
import { requestContext } from "../../config/request-context.js";
import { checkFacilityCoachLimit, getFacilityUsageAndLimits } from "./facility-limits.service.js";

export async function createFacility(
  req: Request,
  res: Response,
): Promise<void> {
  const data = CreateFacilitySchema.parse(req.body);
  try {
    const facility = await prisma.facility.create({ data });
    sendSuccess(res, facility, "Facility created successfully", 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      sendError(res, "Facility code already exists", 409);
    } else {
      throw error;
    }
  }
}

export async function getFacilities(
  req: Request,
  res: Response,
): Promise<void> {
  let where: any = { isActive: true };
  if (req.user?.role === "ADMIN" && req.query.includeInactive === "true") where = {};
  if (!["ADMIN", "MEMBER"].includes(req.user?.role || "")) {
    where = {
      isActive: true,
      staffs: {
        some: {
          userId: req.user?.id,
          isActive: true,
          role: req.user?.role as any,
        },
      },
    };
  }
  const facilities = await prisma.facility.findMany({
    where,
    ...(req.user?.role === "ADMIN"
      ? {
          include: {
            staffs: {
              where: {
                isActive: true,
                role: { in: ["MANAGER", "COACH"] },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    coachProfile: {
                      select: {
                        id: true,
                        specialization: true,
                        experienceYears: true,
                        bio: true,
                        specializations: {
                          select: {
                            sport: {
                              select: { id: true, name: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }
      : {}),
    orderBy: { name: "asc" },
  });
  sendSuccess(res, facilities);
}

export async function getFacilityById(
  req: Request,
  res: Response,
): Promise<void> {
  const facilityId = req.params.facilityId as string;
  if (req.user?.role === "MEMBER") {
    sendSuccess(
      res,
      await prisma.facility.findUnique({ where: { id: facilityId } }),
    );
    return;
  }
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: {
      staffs: {
        ...(req.user?.role === "MANAGER" ? { where: { isActive: true } } : {}),
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              coachProfile: {
                select: {
                  id: true,
                  specializations: {
                    select: {
                      sport: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!facility) {
    sendError(res, "Facility not found", 404);
    return;
  }
  const usage = await getFacilityUsageAndLimits(facilityId);
  sendSuccess(res, { ...facility, usage });
}

export async function updateFacility(
  req: Request,
  res: Response,
): Promise<void> {
  const facilityId = req.params.facilityId as string;
  const data = UpdateFacilitySchema.parse(req.body);
  if (
    data.isActive === false &&
    (await prisma.classSchedule.count({
      where: {
        class: { facilityId },
        status: "SCHEDULED",
        endTime: { gt: new Date() },
      },
    }))
  )
    throw new AppError(
      "Cannot deactivate facility with upcoming sessions",
      409,
    );

  const facility = await prisma.facility.update({
    where: { id: facilityId },
    data,
  });

  sendSuccess(res, facility, "Facility updated successfully", 200);
}

export async function assignStaff(req: Request, res: Response): Promise<void> {
  const facilityId = req.user?.role === "MANAGER"
    ? requestContext.getStore()!.facilityId!
    : String(req.params.facilityId);
  const data = AssignStaffSchema.parse(req.body);
  if (req.user?.role === "ADMIN") {
    if (data.role === "MANAGER") {
      sendSuccess(res, await assignFacilityManager(facilityId, data.userId), "Staff assigned successfully", 201);
      return;
    }
    if (data.role !== "COACH") throw new AppError("Admin chỉ phân công quản lý hoặc HLV vào cơ sở", 403);
  }

  if (req.user?.role === "MANAGER" && data.role === "MANAGER")
    throw new AppError("Only ADMIN assigns managers", 403);
  const user = await User.findById(data.userId).lean();
  if (!user || !user.isActive || user.role !== data.role)
    throw new AppError("Staff role must match an active user", 400);
  const staff = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"staff-assignment:" + data.userId}))`;
    const existing = await requestContext.run(
      { ...requestContext.getStore(), facilityId: undefined },
      () => tx.facilityStaff.findFirst({ where: { userId: data.userId, isActive: true } }),
    );
    if (existing) throw new AppError("Nhân sự đã được phân công vào một cơ sở", 409);
    if (data.role === "COACH") {
      await checkFacilityCoachLimit(facilityId, tx);
    }
    return tx.facilityStaff.upsert({
      where: {
        userId_facilityId_role: {
          userId: data.userId,
          facilityId,
          role: data.role,
        },
      },
      update: { isActive: true },
      create: { userId: data.userId, facilityId, role: data.role },
    });
  });

  sendSuccess(res, staff, "Staff assigned successfully", 201);
}

export async function setFacilityManager(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await assignFacilityManager(String(req.params.facilityId), req.body.userId, req.body.replacedUserId), "Đã cập nhật quản lý cơ sở");
}

export async function removeStaff(req: Request, res: Response): Promise<void> {
  const facilityId = req.params.facilityId as string;
  const userId = req.params.userId as string;
  const role = req.params.role as string;
  if (req.user?.role === "MANAGER" && role === "MANAGER")
    throw new AppError("Only ADMIN removes managers", 403);

  const staff = await prisma.facilityStaff.update({
    where: {
      userId_facilityId_role: {
        userId,
        facilityId,
        role: role as any,
      },
    },
    data: { isActive: false },
  });

  sendSuccess(res, staff, "Staff removed successfully", 200);
}

export async function createFacilityCoach(req: Request, res: Response): Promise<void> {
  const facilityId = req.user?.role === "MANAGER" ? requestContext.getStore()!.facilityId! : String(req.params.facilityId);
  const data = CreateFacilityCoachSchema.parse(req.body);
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility?.isActive) throw new AppError("Facility not found or inactive", 404);
  const user = await createUser({ ...data, role: "COACH", password: data.password || "Coach@123456" }, facilityId);
  sendSuccess(res, user, "Tạo tài khoản thành công", 201);
}

export async function createFacilityReceptionist(req: Request, res: Response): Promise<void> {
  const facilityId = req.user?.role === "MANAGER" ? requestContext.getStore()!.facilityId! : String(req.params.facilityId);
  const data = CreateFacilityReceptionistSchema.parse(req.body);
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility?.isActive) throw new AppError("Facility not found or inactive", 404);
  const user = await createUser({ ...data, role: "RECEPTIONIST", password: data.password || "Receptionist@123456" }, facilityId);
  sendSuccess(res, user, "Tạo tài khoản thành công", 201);
}

export async function getFacilityLimits(req: Request, res: Response): Promise<void> {
  const facilityId = req.user?.role === "MANAGER"
    ? requestContext.getStore()!.facilityId!
    : String(req.params.facilityId);
  sendSuccess(res, await getFacilityUsageAndLimits(facilityId));
}

