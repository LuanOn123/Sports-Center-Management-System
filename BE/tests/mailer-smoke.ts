/**
 * Smoke test mailer: cd BE && npx tsx tests/mailer-smoke.ts
 * Gửi 1 email OTP tới chính SMTP_USER để kiểm tra driver đang cấu hình.
 */
import "dotenv/config";
import { sendOtpEmail } from "../src/utils/mailer.js";

const to = process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL;
const driver = process.env.MAIL_DRIVER || "(auto)";

console.log("MAIL_DRIVER =", driver, "| target =", to);

sendOtpEmail(to!, "123456")
  .then(() => console.log("OK: gửi mail thành công"))
  .catch((err) => {
    console.error("FAIL:", err?.message ?? err);
    if (err?.response) console.error("response:", JSON.stringify(err.response));
    if (err?.stack) console.error(err.stack);
    process.exitCode = 1;
  });
