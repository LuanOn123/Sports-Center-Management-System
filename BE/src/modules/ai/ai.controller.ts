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

export async function memberChat(req: Request, res: Response, next: NextFunction) {
  try {
    const reply = await aiService.chatWithAssistant(req.body, req.user!.id);
    sendSuccess(res, { reply });
  } catch (err) {
    next(err);
  }
}

