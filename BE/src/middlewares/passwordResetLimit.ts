import type { RequestHandler } from "express";
/** IP burst protection. The authoritative five-attempt OTP budget is persisted in MongoDB. */
export function passwordResetLimit(
  max: number,
  windowMs = 15 * 60_000,
): RequestHandler {
  const windows = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of windows)
      if (value.until <= now) windows.delete(key);
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = windows.get(key);
    if (!entry) {
      if (windows.size >= 10000) {
        res
          .status(429)
          .json({ success: false, message: "Vui lòng thử lại sau." });
        return;
      }
      entry = { count: 0, until: now + windowMs };
      windows.set(key, entry);
    }
    if (++entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.until - now) / 1000));
      res
        .status(429)
        .json({
          success: false,
          message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
        });
      return;
    }
    next();
  };
}
