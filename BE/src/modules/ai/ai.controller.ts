import { Request, Response, NextFunction } from "express";
import * as aiService from "./ai.service.js";
import { sendSuccess } from "../../utils/response.js";

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const responseText = await aiService.chatWithAssistant(req.body);
    sendSuccess(res, { reply: responseText }, "AI responded successfully");
  } catch (err) {
    next(err);
  }
}

export async function generatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    // req.user.id đến từ middleware authenticate
    const userId = req.user!.id;
    const plan = await aiService.generateTrainingPlan(userId);
    sendSuccess(res, plan, "Đã tạo lịch tập thành công");
  } catch (err) {
    next(err);
  }
}
