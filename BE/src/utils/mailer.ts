/**
 * Mailer utility — thứ tự ưu tiên driver:
 *  1. BREVO_API_KEY  → Brevo HTTP API (khuyến nghị cho Render/cloud, gửi đến mọi email, free 300/ngày)
 *  2. RESEND_API_KEY → Resend API      (cần verify domain để gửi cho người khác)
 *  3. SMTP_USER + SMTP_PASS → Nodemailer SMTP (local dev, Gmail App Password)
 *  4. Không có gì → in OTP ra console (dev simulation)
 *
 * Chiến lược gửi: THỬ TỪNG driver đã cấu hình cho đến khi một driver thành công.
 *  - `MAIL_DRIVER` (nếu set) là lựa chọn đầu tiên, nhưng driver còn lại vẫn là fallback
 *    khi driver đầu lỗi (vd. Brevo khoá "sending platform" → tự rơi xuống SMTP/Resend).
 *  - Mỗi lần thử có timeout SEND_TIMEOUT_MS; mọi lỗi đều được log, chỉ throw khi TẤT CẢ thất bại
 *    để caller (`forgotPassword`) báo lỗi thật cho client thay vì im lặng "gửi thành công".
 */
import nodemailer from 'nodemailer';

const OTP_SUBJECT = 'Mã xác nhận đổi mật khẩu - Sports Center';
/** Mỗi driver tối đa từng này giây — FE abort request ở 60s nên phải dừng sớm hơn. */
const SEND_TIMEOUT_MS = 15_000;

type DriverName = 'brevo' | 'resend' | 'smtp' | 'console';
/** Các driver gửi thật (driver `console` chỉ mô phỏng). */
const REAL_DRIVERS: DriverName[] = ['brevo', 'resend', 'smtp'];

/** Driver có đủ biến môi trường để thử gửi (thiếu config → bỏ qua, không tốn một lần thử). */
function isConfigured(driver: DriverName): boolean {
  if (driver === 'console') return true;
  if (driver === 'brevo')
    return Boolean(process.env.BREVO_API_KEY) &&
      Boolean(process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER);
  if (driver === 'resend') return Boolean(process.env.RESEND_API_KEY);
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: quá ${ms / 1000}s không phản hồi`)),
      ms
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}


// ── 1. Brevo HTTP API driver ──────────────────────────────────────────────
async function sendViaBrevo(to: string, otp: string): Promise<void> {
  const { BrevoClient } = await import('@getbrevo/brevo');

  const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY! });

  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@example.com';
  const senderName  = process.env.BREVO_SENDER_NAME  || 'Sports Center';

  await client.transactionalEmails.sendTransacEmail({
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject: OTP_SUBJECT,
    htmlContent: buildOtpHtml(otp),
    textContent: buildOtpText(otp),
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
    subject: OTP_SUBJECT,
    html: buildOtpHtml(otp),
    text: buildOtpText(otp),
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
    subject: OTP_SUBJECT,
    html: buildOtpHtml(otp),
    text: buildOtpText(otp),
  });
}

// ── Public API ────────────────────────────────────────────────────────────
function runDriver(driver: DriverName, to: string, otp: string): Promise<void> {
  if (driver === 'brevo') return sendViaBrevo(to, otp);
  if (driver === 'resend') return sendViaResend(to, otp);
  if (driver === 'smtp') return sendViaSMTP(to, otp);
  console.log(`[MAILER] TO: ${to} | OTP: ${otp}`);
  return Promise.resolve();
}

/**
 * Gửi OTP qua email. Throw nếu TẤT CẢ driver đã cấu hình đều thất bại
 * (caller quyết định cách báo lỗi — forgotPassword trả 502 thay vì im lặng).
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  // MAIL_DRIVER (nếu set) chọn driver thử ĐẦU TIÊN, bỏ qua thứ tự ưu tiên —
  // nhưng các driver còn lại vẫn giữ làm fallback khi driver đầu không gửi được.
  const rawDriver = (process.env.MAIL_DRIVER ?? '').trim().toLowerCase();
  if (rawDriver && !([...REAL_DRIVERS, 'console'] as string[]).includes(rawDriver)) {
    throw new Error(`MAIL_DRIVER không hợp lệ: "${rawDriver}" (brevo | resend | smtp | console)`);
  }

  const order: DriverName[] =
    rawDriver === 'console'
      ? ['console']
      : rawDriver
        ? [rawDriver as DriverName, ...REAL_DRIVERS.filter((d) => d !== rawDriver && isConfigured(d))]
        : REAL_DRIVERS.filter(isConfigured);

  // 0. Không driver nào được cấu hình → dev simulation (in OTP ra console).
  if (order.length === 0) {
    console.warn('[MAILER] Không có cấu hình email — mô phỏng gửi OTP ra console.');
    console.log(`[MAILER] TO: ${to} | OTP: ${otp}`);
    return;
  }

  console.log(`[MAILER] Chuẩn bị gửi OTP tới ${to} | thứ tự driver: ${order.join(' → ')}`);

  const failures: string[] = [];
  for (const driver of order) {
    try {
      await withTimeout(runDriver(driver, to, otp), SEND_TIMEOUT_MS, driver);
      console.log(`[MAILER] Đã gửi OTP tới ${to} qua driver "${driver}".`);
      return;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push(`${driver}: ${reason}`);
      console.error(`[MAILER] Driver "${driver}" gửi thất bại → ${reason}`);
    }
  }

  throw new Error(`Gửi OTP thất bại — ${failures.join(' | ')}`);
}

// ── HTML template ─────────────────────────────────────────────────────────
/** Bản text thuần — giúp email qua được bộ lọc spam tốt hơn (có alternative ngoài HTML). */
function buildOtpText(otp: string): string {
  return [
    'ĐẶT LẠI MẬT KHẨU - SPORTS CENTER',
    '',
    'Xin chào,',
    'Bạn đã yêu cầu đặt lại mật khẩu tại Sports Center. Mã OTP của bạn là:',
    '',
    otp,
    '',
    'Mã có hiệu lực trong 5 phút.',
    'Nếu bạn không yêu cầu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.',
    '',
    '© 2026 Sports Center Management System',
  ].join('\n');
}

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
