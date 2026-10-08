import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { AppError } from "../../middlewares/errorHandler.js";
import {
  joinWaitlist,
  cancelWaitlistEntry,
} from "./waitlist.service.js";
import {
  getMyWaitlist,
  listScheduleWaitlist,
} from "./waitlist.promotion.js";

/** POST /waitlist — member join waitlist buổi full (tự check-in chính mình). */
export async function joinScheduleWaitlist(req: Request, res: Response, next: NextFunction) {
  try {
    const memberProfile = await prisma.memberProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!memberProfile) throw new AppError("Member profile not found", 404);
    const entry = await joinWaitlist(req.body.scheduleId, memberProfile.id);
    sendCreated(res, entry, "Joined waitlist successfully");
  } catch (err) {
    next(err);
  }
}

/** DELETE /waitlist/:id — member hủy mục chờ của chính mình. */
export async function leaveWaitlist(req: Request, res: Response, next: NextFunction) {
  try {
    const memberProfile = await prisma.memberProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!memberProfile) throw new AppError("Member profile not found", 404);
    const entry = await cancelWaitlistEntry(req.params.id as string, memberProfile.id);
    sendSuccess(res, entry, "Left waitlist successfully");
  } catch (err) {
    next(err);
  }
}

/** GET /waitlist/my — lịch chờ của chính member (GLOBAL). */
export async function getMyWaitlistHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const memberProfile = await prisma.memberProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!memberProfile) throw new AppError("Member profile not found", 404);
    const { entries, pagination } = await getMyWaitlist(memberProfile.id, req.query);
    sendSuccess(res, entries, "Waitlist retrieved successfully", 200, pagination);
  } catch (err) {
    next(err);
  }
}

/** GET /waitlist/schedule/:scheduleId — staff xem waitlist 1 buổi (FACILITY-SCOPED). */
export async function getScheduleWaitlist(req: Request, res: Response, next: NextFunction) {
  try {
    const { entries, pagination } = await listScheduleWaitlist(
      req.params.scheduleId as string,
      req.query,
    );
    sendSuccess(res, entries, "Waitlist retrieved successfully", 200, pagination);
  } catch (err) {
    next(err);
  }
}
