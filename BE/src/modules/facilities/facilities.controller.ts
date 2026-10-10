import { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  CreateFacilitySchema,
  UpdateFacilitySchema,
  AssignStaffSchema,
  CreateFacilityCoachSchema,
} from "./facilities.schema.js";
import { User } from "../../models/User.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { hashPassword } from "../../utils/bcrypt.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { Prisma } from "@prisma/client";
import { assignFacilityManager } from "./facility-manager.service.js";
import { requestContext } from "../../config/request-context.js";

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
  const facilities = await prisma.facility.findMany({ where, ...(req.user?.role === "ADMIN" ? { include: { staffs: { where: { isActive: true, role: "MANAGER" }, include: { user: { select: { id: true, fullName: true, email: true } } } } } } : {}), orderBy: { name: "asc" } });
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
  const facilityId = req.user?.role === "MANAGER"
    ? requestContext.getStore()!.facilityId!
    : String(req.params.facilityId);
  const data = AssignStaffSchema.parse(req.body);
  if (req.user?.role === "ADMIN") {
    if (data.role !== "MANAGER") throw new AppError("Admin chỉ phân công quản lý cơ sở", 403);
    sendSuccess(res, await assignFacilityManager(facilityId, data.userId), "Staff assigned successfully", 201);
    return;
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
  const facilityId = req.user?.role === "MANAGER"
    ? requestContext.getStore()!.facilityId!
    : String(req.params.facilityId);

  const data = CreateFacilityCoachSchema.parse(req.body);

  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility || !facility.isActive) {
    throw new AppError("Facility not found or inactive", 404);
  }

  const uniqueSportIds = [...new Set(data.sportIds)];
  const sports = await prisma.sport.findMany({
    where: { id: { in: uniqueSportIds }, isActive: true },
  });
  if (sports.length !== uniqueSportIds.length) {
    throw new AppError("Một hoặc nhiều bộ môn không tồn tại hoặc đã ngừng hoạt động", 400, {
      code: "INVALID_SPORTS",
    });
  }

  const [existingMongo, existingPg] = await Promise.all([
    User.findOne({ email: data.email }),
    prisma.user.findUnique({ where: { email: data.email } }),
  ]);
  if (existingMongo || existingPg) {
    throw new AppError("Email is already in use", 409);
  }

  const hashedPassword = await hashPassword(data.password || "Coach@123456");

  const mongoUser = new User({
    email: data.email,
    password: hashedPassword,
    fullName: data.fullName,
    phone: data.phone || null,
    gender: data.gender || null,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    role: "COACH",
  });
  await mongoUser.save();
  const userId = mongoUser._id.toString();

  const mongoProfile = new CoachProfile({
    userId,
    specialization: data.specialization || null,
    experienceYears: data.experienceYears ?? null,
    bio: data.bio || null,
  });
  await mongoProfile.save();
  const coachProfileId = mongoProfile._id.toString();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pgUser = await tx.user.create({
        data: {
          id: userId,
          email: data.email,
          password: hashedPassword,
          fullName: data.fullName,
          phone: data.phone || null,
          gender: (data.gender as any) || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          role: "COACH",
        },
      });

      const pgCoachProfile = await tx.coachProfile.create({
        data: {
          id: coachProfileId,
          userId,
          specialization: data.specialization || null,
          experienceYears: data.experienceYears ?? null,
          bio: data.bio || null,
        },
      });

      const facilityStaff = await tx.facilityStaff.create({
        data: {
          userId,
          facilityId,
          role: "COACH",
          isActive: true,
        },
      });

      await tx.coachSpecialization.createMany({
        data: uniqueSportIds.map((sportId) => ({
          coachId: coachProfileId,
          sportId,
        })),
      });

      const specializations = await tx.coachSpecialization.findMany({
        where: { coachId: coachProfileId },
        include: { sport: { select: { id: true, name: true } } },
      });

      return { pgUser, pgCoachProfile, facilityStaff, specializations };
    });

    sendSuccess(
      res,
      {
        id: userId,
        email: mongoUser.email,
        fullName: mongoUser.fullName,
        phone: mongoUser.phone,
        gender: mongoUser.gender,
        role: "COACH",
        isActive: true,
        coachProfile: {
          id: coachProfileId,
          userId,
          specialization: data.specialization || null,
          experienceYears: data.experienceYears ?? null,
          bio: data.bio || null,
          specializations: result.specializations,
        },
        facilityStaff: result.facilityStaff,
      },
      "Coach created successfully",
      201
    );
  } catch (error) {
    await User.deleteOne({ _id: mongoUser._id }).catch(() => {});
    await CoachProfile.deleteOne({ _id: mongoProfile._id }).catch(() => {});
    throw error;
  }
}
