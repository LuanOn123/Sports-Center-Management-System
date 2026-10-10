import { env } from "../../config/env.js";
import { AppError } from "../../middlewares/errorHandler.js";

const unavailable = () => new AppError(
  "Xác minh bảo mật tạm thời không khả dụng. Vui lòng thử lại sau.", 503,
);
const invalid = () => new AppError(
  "Xác minh CAPTCHA không hợp lệ hoặc đã hết hạn. Vui lòng xác minh lại.", 400,
);

/** Always runs server-side; no development bypass or client-supplied success flag. */
export async function verifyTurnstile(token: string): Promise<void> {
  if (typeof token !== "string" || !token.trim() || token.length > 2048)
    throw invalid();
  const secret = env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) throw unavailable();

  let result: unknown;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token.trim() }),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      },
    );
    if (!response.ok) throw unavailable();
    result = await response.json();
  } catch {
    // Never propagate upstream errors, request bodies, secrets or challenge tokens.
    throw unavailable();
  }
  if (!result || typeof result !== "object" || !("success" in result)
    || typeof result.success !== "boolean") throw unavailable();
  // Cloudflare enforces expiry and single use. Bind successful tokens to this flow.
  if (result.success !== true || !("action" in result) || result.action !== "login")
    throw invalid();
}
