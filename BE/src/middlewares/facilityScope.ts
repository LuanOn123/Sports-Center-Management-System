import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { requestContext } from "../config/request-context.js";
import { AppError } from "./errorHandler.js";
export async function checkFacilityScope(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);
    const candidates = [
      req.params.facilityId,
      req.query.facilityId,
      req.body?.facilityId,
      req.get("X-Facility-Id"),
    ].filter((v) => v !== undefined);
    if (
      !candidates.length ||
      candidates.some((v) => typeof v !== "string" || !v.trim())
    )
      throw new AppError("FACILITY_CONTEXT_REQUIRED", 400);
    if (new Set(candidates).size !== 1)
      throw new AppError("CONFLICTING_FACILITY_CONTEXT", 400);
    const facilityId = candidates[0] as string;
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
    });
    const adminFacilityMaintenance = req.user.role === "ADMIN" && req.params.facilityId && ["GET", "PUT", "DELETE"].includes(req.method);
    if (!facility || (!facility.isActive && !adminFacilityMaintenance)) throw new AppError("FORBIDDEN_SCOPE", 403);
    if (req.user.role !== "ADMIN" && req.user.role !== "MEMBER") {
      const assigned = await prisma.facilityStaff.findFirst({
        where: {
          facilityId,
          userId: req.user.id,
          role: req.user.role as any,
          isActive: true,
        },
      });
      if (!assigned) throw new AppError("FORBIDDEN_SCOPE", 403);
    }
    requestContext.run(
      {
        facilityId,
        actorId: req.user.id,
        role: req.user.role,
        reason: req.body?.reason || req.body?.note,
      },
      next,
    );
  } catch (error) {
    next(error);
  }
}
