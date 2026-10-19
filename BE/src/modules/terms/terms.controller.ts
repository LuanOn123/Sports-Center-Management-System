import { Request, Response, NextFunction } from "express";
import * as termsService from "./terms.service.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { getStaffFacilityId } from "../../middlewares/facilityScope.js";
import { AppError } from "../../middlewares/errorHandler.js";

export async function createTerm(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === "MANAGER") {
      const managerFacilityId = await getStaffFacilityId(req.user.id, "MANAGER");
      if (req.body.facilityId && req.body.facilityId !== managerFacilityId) {
        throw new AppError("Quản lý cơ sở chỉ được phép tạo kỳ học cho cơ sở của mình.", 403);
      }
      req.body.facilityId = managerFacilityId;
    }

    const term = await termsService.createTerm(req.body);
    sendCreated(res, term, "Kỳ học đã được khởi tạo thành công");
  } catch (err) {
    next(err);
  }
}

export async function listTerms(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === "MANAGER" || req.user?.role === "RECEPTIONIST") {
      const staffFacilityId = await getStaffFacilityId(req.user.id, req.user.role);
      if (req.query.facilityId && req.query.facilityId !== staffFacilityId && req.query.facilityId !== "system") {
        req.query.facilityId = staffFacilityId;
      } else if (!req.query.facilityId) {
        req.query.facilityId = staffFacilityId;
      }
    }

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

export async function getCurrentTerm(req: Request, res: Response, next: NextFunction) {
  try {
    let facilityId: string | undefined = req.query.facilityId as string | undefined;
    if (req.user?.role === "MANAGER" || req.user?.role === "RECEPTIONIST") {
      facilityId = await getStaffFacilityId(req.user.id, req.user.role);
    }
    const term = await termsService.getCurrentTerm(facilityId);
    sendSuccess(res, term, "Kỳ học hiện tại");
  } catch (err) {
    next(err);
  }
}

export async function getTermById(req: Request, res: Response, next: NextFunction) {
  try {
    const term = await termsService.getTermById(req.params.id as string);
    if (req.user?.role === "MANAGER" || req.user?.role === "RECEPTIONIST") {
      const staffFacilityId = await getStaffFacilityId(req.user.id, req.user.role);
      if (term.facilityId && term.facilityId !== staffFacilityId) {
        throw new AppError("Bạn không có quyền truy cập kỳ học của cơ sở khác.", 403);
      }
    }
    sendSuccess(res, term, "Chi tiết kỳ học");
  } catch (err) {
    next(err);
  }
}

export async function updateTerm(req: Request, res: Response, next: NextFunction) {
  try {
    let managerFacilityId: string | undefined;
    if (req.user?.role === "MANAGER") {
      managerFacilityId = await getStaffFacilityId(req.user.id, "MANAGER");
    }
    const term = await termsService.updateTerm(req.params.id as string, req.body, managerFacilityId);
    sendSuccess(res, term, "Cập nhật kỳ học thành công");
  } catch (err) {
    next(err);
  }
}

export async function deleteTerm(req: Request, res: Response, next: NextFunction) {
  try {
    let managerFacilityId: string | undefined;
    if (req.user?.role === "MANAGER") {
      managerFacilityId = await getStaffFacilityId(req.user.id, "MANAGER");
    }
    const result = await termsService.deleteTerm(req.params.id as string, managerFacilityId);
    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
}
