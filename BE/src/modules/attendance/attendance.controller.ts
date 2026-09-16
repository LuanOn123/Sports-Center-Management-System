import { Request, Response, NextFunction } from "express";
import * as service from "./attendance.service.js";

export const createAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attendance = await service.createAttendance(req.body as any);
    res.status(201).json({ success: true, data: attendance });
  } catch (error) { next(error); }
};

export const getAttendances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getAttendancesBySchedule(req.query.scheduleId as string);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const updateAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attendance = await service.updateAttendance(req.params.id as string, req.body as any);
    res.json({ success: true, data: attendance });
  } catch (error) { next(error); }
};