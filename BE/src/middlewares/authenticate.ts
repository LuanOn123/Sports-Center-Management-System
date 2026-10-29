import { prisma } from "../config/prisma.js";
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { sendError } from "../utils/response.js";
import { User } from "../models/User.js";

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user) { next(); return; }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "Unauthorized: missing token", 401);
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    
    // BR-02: Ensure user is still active and role hasn't changed
    const user = await User.findById(payload.id).select("role isActive tokenVersion provisioningStatus").lean();

    if (!user) {
      sendError(res, "Unauthorized: user not found", 401);
      return;
    }
    if (!user.isActive || (user.provisioningStatus && user.provisioningStatus !== "READY")) {
      sendError(res, "Unauthorized: account is locked", 401);
      return;
    }
    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      sendError(res, "Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.", 401);
      return;
    }
    if (user.role !== payload.role) {
      sendError(res, "Unauthorized: role has changed, please login again", 401);
      return;
    }

    const projection = await prisma.user.findUnique({ where: { id: payload.id }, select: { isActive: true, role: true } });
    if (!projection?.isActive || projection.role !== user.role) {
      sendError(res, "Tài khoản chưa hoàn tất đồng bộ. Vui lòng thử lại hoặc liên hệ hỗ trợ.", 401);
      return;
    }
    req.user = { id: (user._id as any).toString(), role: user.role as any };
    next();
  } catch {
    sendError(res, "Unauthorized: invalid or expired token", 401);
  }
}
