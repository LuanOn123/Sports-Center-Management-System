/**
 * Mailer utility — hỗ trợ 2 driver:
 *  - RESEND_API_KEY có giá trị → dùng Resend API (khuyến nghị cho cloud/Render)
 *  - SMTP_USER + SMTP_PASS     → dùng Nodemailer SMTP (phù hợp local dev / Gmail)
 *  - Không cấu hình cả hai    → in OTP ra console (dev simulation)
 */
import nodemailer from 'nodemailer';

// ── Resend driver ──────────────────────────────────────────────────────────
async function sendViaResend(to: string, otp: string): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.RESEND_FROM || 'onboarding@resend.dev'; // domain riêng nếu có

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Mã xác nhận đổi mật khẩu - Sports Center',
    html: buildOtpHtml(otp),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Nodemailer / SMTP driver ────────────────────────────────────────────────
async function sendViaSMTP(to: string, otp: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Sports Center" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Mã xác nhận đổi mật khẩu - Sports Center',
    html: buildOtpHtml(otp),
  });
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  // Ưu tiên Resend (hoạt động tốt trên cloud, không bị block như Gmail SMTP)
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(to, otp);
  }

  // Fallback: SMTP (local dev hoặc khi đã có SMTP cấu hình đúng)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSMTP(to, otp);
  }

  // Dev simulation: in ra console
  console.warn('[MAILER] Không có RESEND_API_KEY hoặc SMTP credentials — mô phỏng gửi email.');
  console.log(`[MAILER] TO: ${to} | OTP: ${otp}`);
}

// ── HTML template ──────────────────────────────────────────────────────────
function buildOtpHtml(otp: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;
                border: 1px solid #e0e0e0; border-radius: 10px; background: #fafafa;">
      <h2 style="color: #1a1a1a; text-align: center;">🔐 Đặt lại mật khẩu</h2>
      <p style="color: #444;">Xin chào,</p>
      <p style="color: #444;">
        Bạn đã yêu cầu đặt lại mật khẩu tại <strong>Sports Center</strong>.
        Sử dụng mã OTP dưới đây:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 10px;
                     color: #007bff; background: #e8f0fe; padding: 16px 32px;
                     border-radius: 8px; display: inline-block;">
          ${otp}
        </span>
      </div>
      <p style="color: #888; font-size: 14px;">⏱ Mã có hiệu lực trong <strong>5 phút</strong>.</p>
      <p style="color: #888; font-size: 14px;">
        Nếu bạn không yêu cầu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #bbb; text-align: center;">
        © 2026 Sports Center Management System
      </p>
    </div>
  `;
}
