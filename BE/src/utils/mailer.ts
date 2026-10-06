/**
 * Mailer utility — thứ tự ưu tiên driver:
 *  1. BREVO_API_KEY  → Brevo HTTP API (khuyến nghị cho Render/cloud, gửi đến mọi email, free 300/ngày)
 *  2. RESEND_API_KEY → Resend API      (cần verify domain để gửi cho người khác)
 *  3. SMTP_USER + SMTP_PASS → Nodemailer SMTP (local dev, Gmail App Password)
 *  4. Không có gì → in OTP ra console (dev simulation)
 */
import nodemailer from 'nodemailer';

// ── 1. Brevo HTTP API driver ──────────────────────────────────────────────
async function sendViaBrevo(to: string, otp: string): Promise<void> {
  const { BrevoClient } = await import('@getbrevo/brevo');

  const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY! });

  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@example.com';
  const senderName  = process.env.BREVO_SENDER_NAME  || 'Sports Center';

  await client.transactionalEmails.sendTransacEmail({
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject: 'Mã xác nhận đổi mật khẩu - Sports Center',
    htmlContent: buildOtpHtml(otp),
  });
}

// ── 2. Resend API driver ──────────────────────────────────────────────────
async function sendViaResend(to: string, otp: string): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const from     = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const actualTo = process.env.RESEND_TEST_REDIRECT || to;

  if (actualTo !== to) {
    console.log(`[MAILER] Resend redirect OTP (${to}) → ${actualTo} | OTP: ${otp}`);
  }

  const { error } = await resend.emails.send({
    from,
    to: actualTo,
    subject: 'Mã xác nhận đổi mật khẩu - Sports Center',
    html: buildOtpHtml(otp),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── 3. Nodemailer / SMTP driver ───────────────────────────────────────────
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

// ── Public API ────────────────────────────────────────────────────────────
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  // 0. MAIL_DRIVER chỉ định tường minh driver (brevo | resend | smtp | console), bỏ qua thứ tự ưu tiên.
  //    Dùng khi một nhà cung cấp còn key nhưng không gửi được (vd. Brevo khoá "sending platform").
  const driver = (process.env.MAIL_DRIVER ?? '').trim().toLowerCase();
  if (driver === 'brevo') return sendViaBrevo(to, otp);
  if (driver === 'resend') return sendViaResend(to, otp);
  if (driver === 'smtp') return sendViaSMTP(to, otp);
  if (driver === 'console') {
    console.log(`[MAILER] TO: ${to} | OTP: ${otp}`);
    return;
  }
  if (driver) throw new Error(`MAIL_DRIVER không hợp lệ: "${driver}" (brevo | resend | smtp | console)`);

  // 1. Brevo — ưu tiên cao nhất (HTTP API, không bị Render block, gửi mọi email)
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(to, otp);
  }

  // 2. Resend — fallback (cần verify domain để gửi cho người khác)
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(to, otp);
  }

  // 3. SMTP — local dev với Gmail App Password
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSMTP(to, otp);
  }

  // 4. Dev simulation
  console.warn('[MAILER] Không có cấu hình email — mô phỏng gửi OTP ra console.');
  console.log(`[MAILER] TO: ${to} | OTP: ${otp}`);
}

// ── HTML template ─────────────────────────────────────────────────────────
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
