import { Request, Response, NextFunction } from "express";
import * as schedulesService from "./class-schedules.service.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";

export async function listSchedules(req: Request, res: Response, next: NextFunction) {
  try {
    const { schedules, pagination } = await schedulesService.listSchedules(req.query);
    sendSuccess(res, schedules, "Schedules retrieved successfully", 200, pagination);
  } catch (err) { next(err); }
}
export async function createScheduleBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await schedulesService.createScheduleBatch(req.body);
    sendCreated(res, result, `Đã tạo ${result.schedulesCreated} buổi học thành công.`);
  } catch (err) { next(err); }
}
export async function createSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await schedulesService.createSchedule(req.body);
    sendCreated(res, schedule, "Schedule created successfully");
  } catch (err) { next(err); }
}
export async function createActivityPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await schedulesService.createActivityPlan(
      req.body,
      req.user?.role === "ADMIN",
    );
    sendCreated(res, result, `Đã tạo lớp và ${result.schedulesCreated} buổi học thành công.`);
  } catch (err) { next(err); }
}
export async function getScheduleById(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await schedulesService.getScheduleById(req.params.id as string);
    sendSuccess(res, schedule, "Schedule retrieved successfully");
  } catch (err) { next(err); }
}
export async function updateSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await schedulesService.updateSchedule(req.params.id as string, req.body);
    sendSuccess(res, schedule, "Schedule updated successfully");
  } catch (err) { next(err); }
}
export async function deleteSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await schedulesService.deleteSchedule(req.params.id as string);
    sendSuccess(res, schedule, "Schedule cancelled successfully");
  } catch (err) { next(err); }
}
export async function completeSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await schedulesService.completeSchedule(req.params.id as string);
    sendSuccess(res, schedule, "Schedule marked as completed");
  } catch (err) { next(err); }
}

export async function getUnderCapacitySchedules(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await schedulesService.getUnderCapacitySchedules(req.query);
    sendSuccess(res, result, "Under-capacity schedules retrieved successfully");
  } catch (err) { next(err); }
}
