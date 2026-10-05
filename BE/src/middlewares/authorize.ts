import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }
    if (!roles.includes(req.user.role) && !(req.user.role === "ADMIN" && roles.some(role => ["MANAGER", "RECEPTIONIST"].includes(role)))) {
      sendError(res, "Forbidden: insufficient permissions", 403);
      return;
    }
    next();
  };
}
