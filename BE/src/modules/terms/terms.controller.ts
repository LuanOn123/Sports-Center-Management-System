import { Request, Response, NextFunction } from "express";
import * as termsService from "./terms.service.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";

export async function createTerm(req: Request, res: Response, next: NextFunction) {
  try {
    const term = await termsService.createTerm(req.body);
    sendCreated(res, term, "Kỳ học đã được khởi tạo thành công");
  } catch (err) {
    next(err);
  }
}

export async function listTerms(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await termsService.listTerms(req.query);
    if ("term" in result) {
      sendSuccess(res, result.term, "Kỳ học hiện tại");
      return;
    }
    sendSuccess(res, result.terms, "Danh sách kỳ học", 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function getCurrentTerm(_req: Request, res: Response, next: NextFunction) {
  try {
    const term = await termsService.getCurrentTerm();
    sendSuccess(res, term, "Kỳ học hiện tại");
  } catch (err) {
    next(err);
  }
}

export async function getTermById(req: Request, res: Response, next: NextFunction) {
  try {
    const term = await termsService.getTermById(req.params.id as string);
    sendSuccess(res, term, "Chi tiết kỳ học");
  } catch (err) {
    next(err);
  }
}

export async function updateTerm(req: Request, res: Response, next: NextFunction) {
  try {
    const term = await termsService.updateTerm(req.params.id as string, req.body);
    sendSuccess(res, term, "Cập nhật kỳ học thành công");
  } catch (err) {
    next(err);
  }
}

export async function deleteTerm(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await termsService.deleteTerm(req.params.id as string);
    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
}
