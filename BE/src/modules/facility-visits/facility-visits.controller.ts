import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { AppError } from "../../middlewares/errorHandler.js";
import {
  checkIn,
  resolveMemberProfile,
} from "./facility-visits.service.js";
import { getMyVisits, listVisits } from "./facility-visits.queries.js";

/** POST /facility-visits/check-in — member tự check-in tại cơ sở đang chọn. */
export async function selfCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const memberProfile = await prisma.memberProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!memberProfile) throw new AppError("Member profile not found", 404);
    const { visit, duplicate } = await checkIn(memberProfile.id, req.body.method ?? "QR");
    if (duplicate) return void sendSuccess(res, visit, "Already checked in recently");
    sendCreated(res, visit, "Checked in successfully");
  } catch (err) {
    next(err);
  }
}

/** POST /facility-visits/reception-check-in — lễ tân điểm danh hộ member. */
export async function receptionCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await resolveMemberProfile(prisma, req.body.memberId);
    const { visit, duplicate } = await checkIn(profile.id, req.body.method ?? "RECEPTION");
    if (duplicate) return void sendSuccess(res, visit, "Already checked in recently");
    sendCreated(res, visit, "Checked in successfully");
  } catch (err) {
    next(err);
  }
}

/** GET /facility-visits/my — lịch sử vào cửa của chính member (GLOBAL). */
export async function getMyVisitHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { visits, pagination } = await getMyVisits(req.user!.id, req.query);
    sendSuccess(res, visits, "Visits retrieved successfully", 200, pagination);
  } catch (err) {
    next(err);
  }
}

/** GET /facility-visits — staff xem lượt vào cửa (FACILITY-SCOPED). */
export async function listFacilityVisits(req: Request, res: Response, next: NextFunction) {
  try {
    const { visits, pagination } = await listVisits(req.query);
    sendSuccess(res, visits, "Visits retrieved successfully", 200, pagination);
  } catch (err) {
    next(err);
  }
}
