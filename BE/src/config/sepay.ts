import crypto from "node:crypto";

/**
 * Cấu hình thanh toán ONLINE qua SePay (ảnh VietQR + webhook xác nhận chuyển khoản).
 *
 * Đọc env ĐỘNG (mỗi lần gọi) thay vì chốt lúc import để:
 * - app vẫn boot được khi chưa cấu hình SePay (dev/test),
 * - e2e test có thể bật/tắt từng chế độ (mock, bank tài khoản test) giữa các kịch bản.
 *
 * `isSepayConfigured() = false` ⇒ endpoint checkout trả 503 (không tạo giao dịch).
 * `isSepayWebhookConfigured() = false` ⇒ endpoint webhook trả 503 (SePay sẽ retry khi cấu hình xong).
 * `mockMode = true` (chỉ DEV/DEMO/E2E) ⇒ cho phép `POST /payments/sepay/mock-confirm`
 * mô phỏng giao dịch chuyển khoản thành công mà không cần tiền thật.
 *
 * Lưu ý cấu hình trên my.sepay.vn (Cấu hình Công ty → Cấu trúc mã thanh toán):
 * - Tiền tố = `SEPAY_CODE_PREFIX` (mặc định SEVQR — cũng là chuỗi VietinBank yêu cầu trong nội dung),
 * - Hậu tố = `SEPAY_CODE_SUFFIX_LENGTH` ký tự, Loại ký tự = Số nguyên.
 * - Webhook: chọn xác thực API Key = `SEPAY_WEBHOOK_API_KEY` (SePay gửi header `Authorization: Apikey <key>`).
 */
export function sepayConfig() {
  return {
    /** Ngân hàng nhận tiền — short_name / alias / code / BIN trong banks.json của SePay (VD "Sacombank"). */
    bankId: (process.env.VIETQR_BANK_ID ?? "").trim(),
    /** Số tài khoản nhận tiền (hoặc số VA) dùng để tạo QR và đối chiếu webhook. */
    accountNo: (process.env.VIETQR_ACCOUNT_NO ?? "").trim(),
    /** Tên chủ tài khoản hiển thị trên ảnh QR (viết không dấu). */
    accountHolder: (process.env.VIETQR_ACCOUNT_NAME ?? "").trim(),
    /** API key đã cấu hình ở webhook trên my.sepay.vn — dùng để xác thực request webhook. */
    webhookApiKey: (process.env.SEPAY_WEBHOOK_API_KEY ?? "").trim(),
    /** Dịch vụ tạo ảnh QR động của SePay. */
    qrBaseUrl: process.env.SEPAY_QR_BASE_URL?.trim() || "https://qr.sepay.vn/img",
    /** Kiểu hiển thị ảnh QR: compact | qronly | standee | (trống = QR chuẩn kèm logo VietQR). */
    qrTemplate: (process.env.SEPAY_QR_TEMPLATE ?? "compact").trim(),
    /** Tiền tố mã thanh toán — phải khớp "Cấu trúc mã thanh toán" trên my.sepay.vn (2-5 ký tự). */
    codePrefix: ((process.env.SEPAY_CODE_PREFIX ?? "").trim() || "SEVQR").toUpperCase(),
    /** Độ dài phần hậu tố số của mã thanh toán (SePay khuyến nghị 6-8). */
    codeSuffixLength: clamp(Number(process.env.SEPAY_CODE_SUFFIX_LENGTH ?? 8) || 8, 4, 20),
    /** Thời gian sống của một giao dịch chờ thanh toán (phút). */
    ttlMinutes: Math.max(1, Number(process.env.VIETQR_PAYMENT_TTL_MINUTES ?? 15) || 15),
    /** Chỉ DEV/DEMO/E2E: cho phép mô phỏng giao dịch qua `/payments/sepay/mock-confirm`. */
    mockMode: (process.env.SEPAY_MOCK_MODE ?? "false").trim() === "true",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Checkout cần tài khoản nhận tiền để dựng ảnh VietQR. */
export function isSepayConfigured(): boolean {
  const cfg = sepayConfig();
  return Boolean(cfg.bankId && cfg.accountNo);
}

/** Webhook cần API key để xác thực request từ SePay. */
export function isSepayWebhookConfigured(): boolean {
  return Boolean(sepayConfig().webhookApiKey);
}

/** Bỏ dấu tiếng Việt (một số ảnh QR/ngân hàng không nhận ký tự có dấu). */
export function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Chuẩn hoá số tài khoản/VA để so khớp webhook (bỏ khoảng trắng, dấu chấm, gạch ngang…). */
export function normalizeBankAccount(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}

/**
 * Sinh mã thanh toán riêng cho một đơn: `<tiền tố><hậu tố số>` (VD SEVQR12345678).
 * Phần hậu tố dùng số để khớp cấu hình mặc định "Loại ký tự = Số nguyên" của SePay.
 * Tính duy nhất được bảo đảm bởi UNIQUE `Payment.transactionCode` (caller retry khi trùng).
 */
export function buildSepayPaymentCode(cfg = sepayConfig()): string {
  let suffix = "";
  for (let i = 0; i < cfg.codeSuffixLength; i++) {
    suffix += crypto.randomInt(0, 10).toString();
  }
  return `${cfg.codePrefix}${suffix}`;
}

/** Link ảnh VietQR động (số tài khoản + số tiền + nội dung CK) do SePay cung cấp. */
export function buildVietQrUrl(params: { amount: number; content: string }): string {
  const cfg = sepayConfig();
  const url = new URL(cfg.qrBaseUrl);
  url.searchParams.set("acc", cfg.accountNo);
  url.searchParams.set("bank", cfg.bankId);
  url.searchParams.set("amount", String(params.amount));
  url.searchParams.set("des", params.content);
  if (cfg.qrTemplate) url.searchParams.set("template", cfg.qrTemplate);
  if (cfg.accountHolder) url.searchParams.set("holder", stripDiacritics(cfg.accountHolder));
  return url.toString();
}

/**
 * Khi webhook KHÔNG có `code` (SePay chưa bóc tách được), tự tìm mã thanh toán trong
 * nội dung chuyển khoản theo tiền tố đã cấu hình.
 */
export function extractPaymentCodeFromContent(
  content: string | null | undefined,
  cfg = sepayConfig()
): string | null {
  if (!content) return null;
  const escaped = cfg.codePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}[0-9A-Za-z]{4,32}`, "i").exec(content);
  return match ? match[0].toUpperCase() : null;
}

/** So khớp API key webhook theo kiểu timing-safe (header chuẩn: `Authorization: Apikey <key>`). */
export function verifySepayApiKey(authHeader: string | undefined, expected: string): boolean {
  if (!authHeader || !expected) return false;
  const match = /^apikey\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const received = match[1].trim();
  const bufA = Buffer.from(received, "utf8");
  const bufB = Buffer.from(expected, "utf8");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
