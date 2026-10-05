import { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  CreateFacilitySchema,
  UpdateFacilitySchema,
  AssignStaffSchema,
} from "./facilities.schema.js";
import { User } from "../../models/User.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { Prisma } from "@prisma/client";

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
  const facilities = await prisma.facility.findMany({ where });
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
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!facility) {
    sendError(res, "Facility not found", 404);
    return;
  }
  sendSuccess(res, facility);
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
  const facilityId = req.params.facilityId as string;
  const data = AssignStaffSchema.parse(req.body);

  if (req.user?.role === "MANAGER" && data.role === "MANAGER")
    throw new AppError("Only ADMIN assigns managers", 403);
  const user = await User.findById(data.userId).lean();
  if (!user || !user.isActive || user.role !== data.role)
    throw new AppError("Staff role must match an active user", 400);
  const staff = await prisma.facilityStaff.upsert({
    where: {
      userId_facilityId_role: {
        userId: data.userId,
        facilityId,
        role: data.role as any,
      },
    },
    update: { isActive: true },
    create: {
      userId: data.userId,
      facilityId,
      role: data.role as any,
    },
  });

  sendSuccess(res, staff, "Staff assigned successfully", 201);
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
