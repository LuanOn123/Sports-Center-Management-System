import { createHash } from "node:crypto";
import { Schema, model } from "mongoose";
import type { RequestHandler } from "express";
import { AppError } from "./errorHandler.js";

// Shared, atomic counters survive process restarts and work across API replicas.
const schema = new Schema({
  _id: String,
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});
export const PasswordResetLimit = model("PasswordResetLimit", schema);

export function passwordResetLimit(action: "send" | "verify"): RequestHandler {
  return async (req, _res, next) => {
    try {
      const window = Math.floor(Date.now() / (15 * 60_000));
      const email = String(req.body.email ?? "").trim().toLowerCase();
      for (const [scope, value, max] of [
        ["ip", req.ip ?? "unknown", action === "send" ? 20 : 50],
        ["account", email, action === "send" ? 5 : 15],
      ] as const) {
        const id = createHash("sha256").update(`${action}:${scope}:${window}:${value}`).digest("hex");
        let counter;
        try {
          counter = await PasswordResetLimit.findOneAndUpdate(
            { _id: id },
            { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 15 * 60_000) } },
            { upsert: true, new: true },
          );
        } catch (error: any) {
          if (error.code !== 11000) throw error;
          counter = await PasswordResetLimit.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { new: true });
        }
        if (!counter || counter.count > max)
          throw new AppError("Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.", 429);
      }
      next();
    } catch (error) { next(error); }
  };
}
