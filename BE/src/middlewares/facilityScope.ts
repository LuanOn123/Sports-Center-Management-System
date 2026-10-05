import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";
import { prisma } from "../config/prisma.js";

/**
 * Middleware kiểm tra quyền truy cập Cơ sở (Facility Scope)
 * Theo đặc tả BR-AUTH-02:
 * - Admin thấy toàn hệ thống (bỏ qua check scope).
 * - Manager và Receptionist chỉ thao tác dữ liệu của cơ sở được phân công.
 */
export async function checkFacilityScope(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    // Admin có quyền toàn cục
    if (req.user.role === "ADMIN") {
      next();
      return;
    }

    // Lấy facilityId từ param, query, hoặc body
    const facilityId =
      req.params.facilityId ||
      req.query.facilityId ||
      req.body.facilityId;

    if (!facilityId) {
      // Nếu API không yêu cầu facility cụ thể (vd: GET /facilities chung), 
      // tùy router mà chặn hoặc lấy danh sách theo quyền. 
      // Tạm thời cho pass để Controller xử lý tiếp.
      next();
      return;
    }

    // Nếu có truyền facilityId -> Kiểm tra user có được phân công ở cơ sở này không
    if (["MANAGER", "RECEPTIONIST", "COACH"].includes(req.user.role)) {
      const staffRecord = await prisma.facilityStaff.findUnique({
        where: {
          userId_facilityId_role: {
            userId: req.user.id,
            facilityId: String(facilityId),
            role: req.user.role as any,
          },
        },
      });

      if (!staffRecord || !staffRecord.isActive) {
        sendError(res, "FORBIDDEN_SCOPE", 403);
        return;
      }
    }

    // Tới bước này nghĩa là hợp lệ
    next();
  } catch (error) {
    console.error("Facility scope check error:", error);
    sendError(res, "Internal server error during scope check", 500);
  }
}
