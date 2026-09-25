/**
 * E2E THẬT (HTTP + PostgreSQL) cho thanh toán ONLINE qua SePay (chuyển khoản VietQR):
 * - `POST /payments/sepay/checkout`     → Member tạo đơn PENDING + mã thanh toán + ảnh QR.
 * - `POST /payments/sepay/webhook`      → SePay xác nhận giao dịch (API key) ⇒ kích hoạt gói + invoice.
 * - `GET  /payments/sepay/{id}`         → FE polling trạng thái (PENDING → SUCCESS).
 * - `POST /payments/sepay/mock-confirm` → DEV/DEMO (SEPAY_MOCK_MODE=true).
 *
 * Chạy: cd BE && npm run test:e2e:sepay   (hoặc: npx tsx tests/sepay-payment.e2e.ts)
 *
 * Điểm đáng chú ý: SePay KHÔNG có API outbound (BE chỉ dựng URL ảnh VietQR + nhận webhook),
 * nên suite test trực tiếp các nhánh webhook: sai API key / mã đơn lạ / tiền ra / lệch tài khoản /
 * lệch số tiền / hợp lệ / webhook lặp / tiền về muộn / mock-confirm.
 */
import "dotenv/config";
import type { AddressInfo } from "node:net";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { hashPassword } from "../src/utils/bcrypt.js";

const RUN = Date.now().toString(36);
const PASSWORD = "E2eSepay!2026";
const DAY = 24 * 60 * 60 * 1000;
const SEPAY_PENDING_CODE = "SEPAY_PAYMENT_PENDING";

const E2E_SEPAY = {
  bankId: "Sacombank",
  accountNo: "0703339186",
  accountHolder: "NGUYEN TRAN TU",
  apiKey: "e2e_sepay_api_key_1234567890",
  prefix: "SEVQR",
  suffixLength: 8,
};

let baseUrl = "";

type HttpResult = { status: number; body: any; text: string };

async function http(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<HttpResult> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Report helpers ───────────────────────────────────────────────────────
let passed = 0;
const failures: string[] = [];

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function safe(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function check(name: string, condition: boolean, detail?: unknown): boolean {
  if (condition) {
    passed++;
    console.log(`  [OK]   ${name}`);
  } else {
    const msg = `${name}${detail === undefined ? "" : ` — ${safe(detail)}`}`;
    failures.push(msg);
    console.log(`  [FAIL] ${msg}`);
  }
  return condition;
}

/**
 * Đặt biến môi trường SePay cho từng kịch bản (config đọc env động).
 * `configured: false` ⇒ bỏ cấu hình tài khoản nhận tiền để test nhánh 503.
 */
function setSepayEnv(opts: {
  configured?: boolean;
  webhookKey?: string;
  mock?: boolean;
  ttlMinutes?: number;
}): void {
  const { configured = true, webhookKey = E2E_SEPAY.apiKey, mock = false, ttlMinutes } = opts;
  process.env.VIETQR_BANK_ID = configured ? E2E_SEPAY.bankId : "";
  process.env.VIETQR_ACCOUNT_NO = configured ? E2E_SEPAY.accountNo : "";
  process.env.VIETQR_ACCOUNT_NAME = E2E_SEPAY.accountHolder;
  process.env.SEPAY_WEBHOOK_API_KEY = webhookKey;
  process.env.SEPAY_CODE_PREFIX = E2E_SEPAY.prefix;
  process.env.SEPAY_CODE_SUFFIX_LENGTH = String(E2E_SEPAY.suffixLength);
  process.env.SEPAY_MOCK_MODE = mock ? "true" : "false";
  process.env.SEPAY_QR_TEMPLATE = "compact";
  process.env.VIETQR_PAYMENT_TTL_MINUTES = String(ttlMinutes ?? 15);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────
const created = {
  userIds: [] as string[],
  memberProfileIds: [] as string[],
  planIds: [] as string[],
};

type FixtureUser = { id: string; email: string; token: string; memberProfileId: string };

async function createUser(
  role: "MEMBER" | "COACH" | "STAFF" | "MANAGER",
  tag: string,
  hashedPassword: string
): Promise<FixtureUser> {
  const email = `e2e-sepay-${RUN}-${tag.toLowerCase()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName: `E2E SePay ${tag} ${RUN}`,
      role,
      ...(role === "MEMBER" ? { memberProfile: { create: {} } } : {}),
      ...(role === "COACH" ? { coachProfile: { create: {} } } : {}),
      ...(role === "MANAGER" ? { managerProfile: { create: {} } } : {}),
    },
    include: { memberProfile: true },
  });
  created.userIds.push(user.id);
  const memberProfileId = user.memberProfile?.id ?? "";
  if (memberProfileId) created.memberProfileIds.push(memberProfileId);

  const login = await http("POST", "/auth/login", { body: { email, password: PASSWORD } });
  const token = login.body?.data?.accessToken as string | undefined;
  if (login.status !== 200 || !token) {
    throw new Error(`Login failed for fixture ${email}: ${safe(login)}`);
  }
  return { id: user.id, email, token, memberProfileId };
}

async function createPlan(managerToken: string, payload: Record<string, unknown>): Promise<any> {
  const res = await http("POST", "/membership-plans", { token: managerToken, body: payload });
  if (res.status !== 201) throw new Error(`createPlan failed: ${safe(res)}`);
  created.planIds.push(res.body.data.id);
  return res.body.data;
}

// ─── SePay webhook helpers ────────────────────────────────────────────────
/** Block 1000 sepayId riêng cho mỗi lần chạy — tránh đụng dữ liệu của lần chạy trước. */
const SEPAY_ID_BASE = 1_000_000_000 + (Math.floor(Date.now() / 1000) % 1_000_000) * 1000;
let sepayIdCounter = SEPAY_ID_BASE;
const sentSepayIds: number[] = [];

function nextSepayId(): number {
  sepayIdCounter += 1;
  sentSepayIds.push(sepayIdCounter);
  return sepayIdCounter;
}

/** Payload webhook đúng chuẩn SePay cho một Payment trong DB. */
function webhookBody(
  payment: { transactionCode: string | null; amount: unknown },
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const id = (overrides.id as number | undefined) ?? nextSepayId();
  return {
    id,
    gateway: E2E_SEPAY.bankId.toUpperCase(),
    transactionDate: "2026-09-25 11:08:33",
    accountNumber: E2E_SEPAY.accountNo,
    subAccount: "",
    code: payment.transactionCode,
    content: `${payment.transactionCode} chuyen tien`,
    transferType: "in",
    description: "NGUYEN VAN A chuyen tien",
    transferAmount: Number(payment.amount),
    accumulated: 105000000,
    referenceCode: `FT${id}`,
    ...overrides,
  };
}

const sepayWebhook = (body: Record<string, unknown>, apiKey: string | null = E2E_SEPAY.apiKey) =>
  http("POST", "/payments/sepay/webhook", {
    body,
    headers: apiKey === null ? {} : { Authorization: `Apikey ${apiKey}` },
  });

// ─── API helpers ──────────────────────────────────────────────────────────
const checkout = (token: string, planId: string) =>
  http("POST", "/payments/sepay/checkout", { token, body: { planId } });
const getCheckout = (token: string, paymentId: string) =>
  http("GET", `/payments/sepay/${paymentId}`, { token });
const mockConfirm = (token: string, paymentId: string) =>
  http("POST", "/payments/sepay/mock-confirm", { token, body: { paymentId } });
const membershipStatus = (token: string, memberId: string) =>
  http("GET", `/members/${memberId}/membership-status`, { token });

const activeSubscriptions = (memberProfileId: string) =>
  prisma.membershipSubscription.findMany({
    where: { memberId: memberProfileId, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

const sepayEvent = (sepayId: number) =>
  prisma.sepayWebhookEvent.findUnique({ where: { sepayId } });

type Ctx = {
  manager: FixtureUser;
  plans: { membership30: any; membership7: any; premium90: any };
};

/** A) Chưa cấu hình SePay (thiếu TK nhận tiền / thiếu API key webhook) → 503. */
async function scenarioNotConfigured(member: FixtureUser, plan: any): Promise<void> {
  section("A) Chưa cấu hình SePay → checkout 503, webhook 503");

  setSepayEnv({ configured: false });
  const blocked = await checkout(member.token, plan.id);
  check("checkout khi chưa cấu hình TK nhận tiền → 503", blocked.status === 503, blocked.body);
  check(
    "errors.code = SEPAY_NOT_CONFIGURED",
    blocked.body?.errors?.code === "SEPAY_NOT_CONFIGURED",
    blocked.body?.errors
  );

  const noBankWebhook = await sepayWebhook(webhookBody({ transactionCode: "SEVQR00000000", amount: 1000 }));
  check(
    "webhook khi chưa cấu hình TK nhận tiền → 503",
    noBankWebhook.status === 503 && noBankWebhook.body?.errors?.code === "SEPAY_NOT_CONFIGURED",
    noBankWebhook.body
  );

  setSepayEnv({ webhookKey: "" });
  const noKey = await sepayWebhook(webhookBody({ transactionCode: "SEVQR00000000", amount: 1000 }));
  check(
    "webhook khi chưa cấu hình SEPAY_WEBHOOK_API_KEY → 503",
    noKey.status === 503 && noKey.body?.errors?.code === "SEPAY_NOT_CONFIGURED",
    noKey.body
  );

  setSepayEnv({});
}

/** B) Luồng chính: checkout → QR → các nhánh webhook → kích hoạt gói + hóa đơn + thông báo. */
async function scenarioCheckoutAndWebhookCore(
  ctx: Ctx,
  member: FixtureUser,
  other: FixtureUser,
  coach: FixtureUser,
  plan: any
): Promise<string> {
  section("B) Checkout → QR → webhook (sai key / mã lạ / tiền ra / lệch TK / lệch tiền / thành công / lặp)");
  setSepayEnv({});

  const res = await checkout(member.token, plan.id);
  check("checkout → 201", res.status === 201, res.body);
  const data = res.body?.data ?? {};
  check(
    "orderCode đúng định dạng SEVQR + 8 số",
    /^SEVQR\d{8}$/.test(String(data.orderCode)),
    data.orderCode
  );
  check(
    "amount = 300000, currency VND, status PENDING, gateway SEPAY",
    data.amount === 300000 &&
      data.currency === "VND" &&
      data.status === "PENDING" &&
      data.gateway === "SEPAY",
    data
  );
  check(
    "qrUrl là ảnh VietQR kèm acc/bank/amount/des",
    String(data.qrUrl).startsWith("https://qr.sepay.vn/img?") &&
      String(data.qrUrl).includes(`acc=${E2E_SEPAY.accountNo}`) &&
      String(data.qrUrl).includes(`bank=${E2E_SEPAY.bankId}`) &&
      String(data.qrUrl).includes("amount=300000") &&
      String(data.qrUrl).includes(`des=${data.orderCode}`),
    data.qrUrl
  );
  check(
    "transferContent = orderCode và bank info đúng cấu hình",
    data.transferContent === data.orderCode &&
      data.bank?.accountNumber === E2E_SEPAY.accountNo &&
      data.bank?.id === E2E_SEPAY.bankId &&
      data.bank?.accountHolder === E2E_SEPAY.accountHolder,
    data.bank
  );
  check("response có expiresAt (TTL 15 phút)", Boolean(data.expiresAt), data.expiresAt);

  const paymentId = data.paymentId as string;
  const dbPending = await prisma.payment.findUnique({ where: { id: paymentId } });
  check(
    "DB: PENDING + method/gateway SEPAY + planId + transactionCode = orderCode",
    dbPending?.status === "PENDING" &&
      dbPending?.method === "SEPAY" &&
      dbPending?.gateway === "SEPAY" &&
      dbPending?.planId === plan.id &&
      dbPending?.transactionCode === data.orderCode,
    dbPending
  );
  check(
    "DB: CHƯA có subscriptionId/paidAt (chưa kích hoạt gói)",
    dbPending?.subscriptionId === null && dbPending?.paidAt === null
  );

  const poll = await getCheckout(member.token, paymentId);
  check(
    "GET /payments/sepay/:id (chủ đơn) → 200 PENDING + qrUrl",
    poll.status === 200 && poll.body?.data?.status === "PENDING" && Boolean(poll.body?.data?.qrUrl),
    poll.body?.data
  );
  const foreignGet = await getCheckout(other.token, paymentId);
  check("MEMBER khác xem đơn → 403", foreignGet.status === 403, foreignGet.body);
  const coachGet = await getCheckout(coach.token, paymentId);
  check("COACH xem đơn → 403", coachGet.status === 403, coachGet.body);

  const second = await checkout(member.token, plan.id);
  check("checkout lần 2 khi còn PENDING → 409", second.status === 409, second.body);
  check(
    `errors.code = ${SEPAY_PENDING_CODE}`,
    second.body?.errors?.code === SEPAY_PENDING_CODE,
    second.body?.errors
  );
  check(
    "409 trả kèm paymentId/orderCode/qrUrl/expiresAt để FE tiếp tục thanh toán",
    Boolean(second.body?.errors?.paymentId) &&
      Boolean(second.body?.errors?.orderCode) &&
      Boolean(second.body?.errors?.qrUrl) &&
      Boolean(second.body?.errors?.expiresAt),
    second.body?.errors
  );

  // ── Webhook: sai/thiếu API key ─────────────────────────────────────────
  const noAuth = await sepayWebhook(webhookBody(dbPending!), null);
  check(
    "webhook thiếu Authorization → 401 SEPAY_INVALID_API_KEY",
    noAuth.status === 401 && noAuth.body?.errors?.code === "SEPAY_INVALID_API_KEY",
    noAuth.body
  );
  const badKey = await sepayWebhook(webhookBody(dbPending!), "sai_api_key");
  check(
    "webhook sai API key → 401",
    badKey.status === 401 && badKey.body?.errors?.code === "SEPAY_INVALID_API_KEY",
    badKey.body
  );
  const payloadInvalid = await sepayWebhook({ transferType: "in" });
  check("webhook payload thiếu id → 400 (validate zod)", payloadInvalid.status === 400, payloadInvalid.body);

  // ── Webhook: mã đơn lạ → ack & ghi log IGNORED ─────────────────────────
  const unknown = webhookBody({ transactionCode: "SEVQR99999999", amount: 300000 });
  const unknownRes = await sepayWebhook(unknown);
  check(
    "webhook mã đơn lạ → 200 { success: true } (ack, không retry)",
    unknownRes.status === 200 && unknownRes.body?.success === true,
    unknownRes.body
  );
  const unknownEvent = await sepayEvent(unknown.id as number);
  check(
    "SepayWebhookEvent: IGNORED / ORDER_NOT_FOUND",
    unknownEvent?.status === "IGNORED" && unknownEvent?.reason === "ORDER_NOT_FOUND",
    unknownEvent
  );
  check("Payment vẫn PENDING (không xử lý gì)", (await prisma.payment.findUnique({ where: { id: paymentId } }))?.status === "PENDING");

  // ── Webhook: tiền RA → bỏ qua ──────────────────────────────────────────
  const outBody = webhookBody(dbPending!, { transferType: "out" });
  const outRes = await sepayWebhook(outBody);
  check("webhook transferType = out → 200 ack", outRes.status === 200 && outRes.body?.success === true, outRes.body);
  const outEvent = await sepayEvent(outBody.id as number);
  check(
    "SepayWebhookEvent: IGNORED / OUT_TRANSFER",
    outEvent?.status === "IGNORED" && outEvent?.reason === "OUT_TRANSFER",
    outEvent
  );

  // ── Webhook: LỆCH TÀI KHOẢN nhận tiền → không kích hoạt ────────────────
  const wrongAccBody = webhookBody(dbPending!, { accountNumber: "9999999999" });
  const wrongAcc = await sepayWebhook(wrongAccBody);
  check("webhook lệch số tài khoản → 200 ack", wrongAcc.status === 200 && wrongAcc.body?.success === true, wrongAcc.body);
  const accEvent = await sepayEvent(wrongAccBody.id as number);
  check(
    "SepayWebhookEvent: MISMATCH / ACCOUNT_MISMATCH",
    accEvent?.status === "MISMATCH" && accEvent?.reason === "ACCOUNT_MISMATCH",
    accEvent
  );

  // ── Webhook: LỆCH SỐ TIỀN → không kích hoạt ────────────────────────────
  const wrongAmountBody = webhookBody(dbPending!, { transferAmount: Number(dbPending!.amount) + 5000 });
  const wrongAmount = await sepayWebhook(wrongAmountBody);
  check("webhook lệch số tiền → 200 ack", wrongAmount.status === 200 && wrongAmount.body?.success === true, wrongAmount.body);
  const amountEvent = await sepayEvent(wrongAmountBody.id as number);
  check(
    "SepayWebhookEvent: MISMATCH / AMOUNT_MISMATCH",
    amountEvent?.status === "MISMATCH" && amountEvent?.reason === "AMOUNT_MISMATCH",
    amountEvent
  );
  const stillPending = await prisma.payment.findUnique({ where: { id: paymentId } });
  check(
    "Sau các webhook lệch: Payment vẫn PENDING + note đối soát",
    stillPending?.status === "PENDING" && String(stillPending?.note ?? "").includes("lệch số tiền"),
    stillPending?.note
  );
  await sleep(200);
  const mismatchNotify = await prisma.notification.findFirst({
    where: { userId: member.id, title: "Giao dịch chuyển khoản cần đối soát" },
    orderBy: { createdAt: "desc" },
  });
  check("Notification GENERAL nhắc hội viên đối soát khi tiền không khớp", Boolean(mismatchNotify), mismatchNotify?.body);

  // ── Webhook HỢP LỆ → kích hoạt gói + invoice + thông báo ───────────────
  const okBody = webhookBody(dbPending!);
  const okRes = await sepayWebhook(okBody);
  check(
    "webhook hợp lệ → 200 { success: true } (SePay không cần retry)",
    okRes.status === 200 && okRes.body?.success === true,
    okRes
  );
  const okEvent = await sepayEvent(okBody.id as number);
  check(
    "SepayWebhookEvent: PROCESSED + gắn đúng paymentId",
    okEvent?.status === "PROCESSED" && okEvent?.paymentId === paymentId,
    okEvent
  );

  const paid = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true, subscription: { include: { plan: true } } },
  });
  check(
    "DB: Payment SUCCESS + paidAt + gatewayTransId = referenceCode + gatewayPayload là payload webhook",
    paid?.status === "SUCCESS" &&
      Boolean(paid?.paidAt) &&
      paid?.gatewayTransId === okBody.referenceCode &&
      (paid?.gatewayPayload as Record<string, unknown>)?.id === okBody.id,
    { status: paid?.status, gatewayTransId: paid?.gatewayTransId }
  );
  check(
    "DB: Invoice ISSUED + snapshot planName/planTier (BR-25)",
    paid?.invoice?.status === "ISSUED" &&
      paid?.invoice?.planName === plan.name &&
      paid?.invoice?.planTier === plan.tier,
    paid?.invoice
  );
  const sub = paid?.subscription;
  const days = sub ? Math.round((sub.endDate.getTime() - sub.startDate.getTime()) / DAY) : 0;
  check(
    `DB: Subscription ACTIVE tier ${plan.tier} đúng ${plan.durationDays} ngày`,
    sub?.status === "ACTIVE" && sub?.tier === plan.tier && days === plan.durationDays,
    { status: sub?.status, tier: sub?.tier, days }
  );
  await sleep(200);
  const successNotify = await prisma.notification.findFirst({
    where: { userId: member.id, type: "PAYMENT_SUCCESS" },
    orderBy: { createdAt: "desc" },
  });
  check("Notification PAYMENT_SUCCESS sau khi gói được kích hoạt", Boolean(successNotify), successNotify?.title);

  const statusRes = await getCheckout(member.token, paymentId);
  check(
    "GET /payments/sepay/:id → SUCCESS + paidAt + subscriptionId",
    statusRes.status === 200 &&
      statusRes.body?.data?.status === "SUCCESS" &&
      Boolean(statusRes.body?.data?.paidAt) &&
      statusRes.body?.data?.subscriptionId === paid?.subscriptionId,
    statusRes.body?.data
  );
  const mStatus = await membershipStatus(ctx.manager.token, member.memberProfileId);
  check(
    "membership-status: effectiveTier = MEMBERSHIP sau khi thanh toán",
    mStatus.body?.data?.effectiveTier === "MEMBERSHIP",
    mStatus.body?.data
  );

  // ── Chống webhook trùng: cùng sepayId (SePay retry) ─────────────────────
  const dup = await sepayWebhook(okBody);
  check("webhook lặp CÙNG sepayId → 200 ack", dup.status === 200 && dup.body?.success === true, dup.body);
  const dupEventRows = await prisma.sepayWebhookEvent.count({ where: { sepayId: okBody.id as number } });
  check("Chỉ có ĐÚNG 1 bản ghi SepayWebhookEvent cho sepayId đó", dupEventRows === 1, dupEventRows);
  check(
    "DB: KHÔNG tạo subscription thứ 2 cho cùng giao dịch",
    (await activeSubscriptions(member.memberProfileId)).length === 1
  );

  // ── Chống webhook trùng: sepayId MỚI nhưng đơn đã SUCCESS ──────────────
  const secondTransfer = webhookBody(dbPending!);
  const dupDifferentId = await sepayWebhook(secondTransfer);
  check("webhook sepayId mới cho đơn đã SUCCESS → 200 ack", dupDifferentId.status === 200, dupDifferentId.body);
  const dupDifferentEvent = await sepayEvent(secondTransfer.id as number);
  check(
    "SepayWebhookEvent: DUPLICATE / PAYMENT_ALREADY_PAID",
    dupDifferentEvent?.status === "DUPLICATE" && dupDifferentEvent?.reason === "PAYMENT_ALREADY_PAID",
    dupDifferentEvent
  );
  check(
    "DB: vẫn chỉ 1 subscription ACTIVE",
    (await activeSubscriptions(member.memberProfileId)).length === 1
  );

  // ── webhook viết thường "apikey ..." vẫn được chấp nhận (docs SePay) ───
  const lowerHeader = await http("POST", "/payments/sepay/webhook", {
    body: webhookBody(dbPending!),
    headers: { Authorization: `apikey ${E2E_SEPAY.apiKey}` },
  });
  check(
    "header `apikey` (chữ thường) vẫn xác thực được → 200",
    lowerHeader.status === 200 && lowerHeader.body?.success === true,
    lowerHeader.body
  );

  return paymentId;
}

/** C) DEV/DEMO: SEPAY_MOCK_MODE điều khiển endpoint mock-confirm + quyền xác nhận hộ. */
async function scenarioMockMode(
  ctx: Ctx,
  member: FixtureUser,
  other: FixtureUser,
  coach: FixtureUser,
  manager: FixtureUser,
  plan: any
): Promise<void> {
  section("C) Mock-confirm (SEPAY_MOCK_MODE) + quyền xác nhận");

  setSepayEnv({ mock: false });
  const res0 = await checkout(member.token, plan.id);
  check("checkout (mock tắt) → 201", res0.status === 201, res0.body);
  const paymentId = res0.body?.data?.paymentId as string;

  const disabled = await mockConfirm(member.token, paymentId);
  check(
    "mock-confirm khi SEPAY_MOCK_MODE=false → 403 SEPAY_MOCK_DISABLED",
    disabled.status === 403 && disabled.body?.errors?.code === "SEPAY_MOCK_DISABLED",
    disabled.body
  );

  setSepayEnv({ mock: true });
  const foreign = await mockConfirm(other.token, paymentId);
  check("MEMBER khác mock-confirm → 403", foreign.status === 403, foreign.body);
  const coachRes = await mockConfirm(coach.token, paymentId);
  check("COACH mock-confirm → 403", coachRes.status === 403, coachRes.body);

  const ok = await mockConfirm(member.token, paymentId);
  check(
    "mock-confirm (chủ đơn) → processed=true, PROCESSED, paymentStatus SUCCESS, có subscriptionId",
    ok.status === 200 &&
      ok.body?.data?.processed === true &&
      ok.body?.data?.status === "PROCESSED" &&
      ok.body?.data?.paymentStatus === "SUCCESS" &&
      Boolean(ok.body?.data?.subscriptionId),
    ok.body?.data
  );
  const again = await mockConfirm(member.token, paymentId);
  check(
    "mock-confirm lặp lại → processed=false, status DUPLICATE",
    again.body?.data?.processed === false && again.body?.data?.status === "DUPLICATE",
    again.body?.data
  );
  check(
    "DB: chỉ 1 subscription ACTIVE",
    (await activeSubscriptions(member.memberProfileId)).length === 1
  );

  const otherCheckout = await checkout(other.token, plan.id);
  const managerRes = await mockConfirm(manager.token, otherCheckout.body?.data?.paymentId as string);
  check(
    "MANAGER mock-confirm hộ (demo) → 200 paymentStatus SUCCESS",
    managerRes.status === 200 && managerRes.body?.data?.paymentStatus === "SUCCESS",
    managerRes.body?.data
  );

  setSepayEnv({ mock: false });
}

/** D) Đơn hết hạn được đóng khi checkout lại + tiền về MUỘN (LATE) không kích hoạt. */
async function scenarioExpiredPendingAndLate(member: FixtureUser, plan: any): Promise<void> {
  section("D) Đơn hết hạn (TTL) + tiền về MUỘN không kích hoạt gói");

  setSepayEnv({ ttlMinutes: 15 });
  const first = await checkout(member.token, plan.id);
  check("checkout → 201", first.status === 201, first.body);
  const firstId = first.body?.data?.paymentId as string;
  const firstCode = first.body?.data?.orderCode as string;

  // Giả lập quá TTL: đẩy createdAt lùi 30 phút rồi checkout lại.
  await prisma.payment.update({
    where: { id: firstId },
    data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) },
  });
  const second = await checkout(member.token, plan.id);
  check(
    "checkout lại sau TTL → 201 + mã thanh toán MỚI",
    second.status === 201 && second.body?.data?.orderCode !== firstCode,
    second.body?.data?.orderCode
  );
  const oldRow = await prisma.payment.findUnique({ where: { id: firstId } });
  check(
    "Đơn cũ bị đóng → FAILED + note hết hạn",
    oldRow?.status === "FAILED" && String(oldRow?.note ?? "").includes("Hết hạn"),
    oldRow?.note
  );

  // Tiền về muộn cho đơn cũ → ack, ghi LATE, KHÔNG kích hoạt.
  const lateBody = webhookBody({ transactionCode: firstCode, amount: oldRow!.amount });
  const late = await sepayWebhook(lateBody);
  check("webhook tiền về muộn → 200 ack", late.status === 200 && late.body?.success === true, late.body);
  const lateEvent = await sepayEvent(lateBody.id as number);
  check(
    "SepayWebhookEvent: LATE / LATE_RESULT",
    lateEvent?.status === "LATE" && lateEvent?.reason === "LATE_RESULT",
    lateEvent
  );
  const afterLate = await prisma.payment.findUnique({ where: { id: firstId } });
  check(
    "Đơn cũ vẫn FAILED + note 'cần đối soát'",
    afterLate?.status === "FAILED" && String(afterLate?.note ?? "").includes("cần đối soát"),
    afterLate?.note
  );
  check(
    "KHÔNG kích hoạt gói từ giao dịch muộn",
    (await activeSubscriptions(member.memberProfileId)).length === 0
  );

  // Đơn mới được thanh toán → kích hoạt bình thường.
  const newBody = webhookBody({
    transactionCode: second.body?.data?.orderCode,
    amount: second.body?.data?.amount,
  });
  const ok = await sepayWebhook(newBody);
  check(
    "webhook cho đơn mới → PROCESSED + kích hoạt gói",
    ok.status === 200 && (await sepayEvent(newBody.id as number))?.status === "PROCESSED",
    ok.body
  );
  check(
    "DB: Subscription ACTIVE sau khi đơn mới được thanh toán",
    (await activeSubscriptions(member.memberProfileId)).length === 1
  );
}

/** E) Chặn gói FREE / hạ hạng + nâng cấp PREMIUM (cộng ngày dư của gói cũ). */
async function scenarioGuardsAndUpgrade(
  ctx: Ctx,
  member: FixtureUser,
  freePlanId: string
): Promise<void> {
  section("E) Chặn gói FREE / hạ hạng + nâng cấp PREMIUM (cộng ngày dư)");
  setSepayEnv({});

  const free = await checkout(member.token, freePlanId);
  check("checkout gói FREE → 400", free.status === 400, free.body);
  const notFound = await checkout(member.token, "00000000-0000-0000-0000-000000000000");
  check("checkout gói không tồn tại → 404", notFound.status === 404, notFound.body);
  const downgrade = await checkout(member.token, ctx.plans.membership7.id);
  check("checkout cùng hạng ít ngày hơn (30 ngày → 7 ngày) → 400", downgrade.status === 400, downgrade.body);

  const beforeSubs = await prisma.membershipSubscription.findMany({
    where: { memberId: member.memberProfileId },
  });
  const activeBefore = beforeSubs.filter((s) => s.status === "ACTIVE");
  check("Trước nâng cấp: đang có 1 gói MEMBERSHIP ACTIVE", activeBefore.length === 1 && activeBefore[0].tier === "MEMBERSHIP", activeBefore.map((s) => s.tier));

  const upgrade = await checkout(member.token, ctx.plans.premium90.id);
  check("checkout nâng cấp PREMIUM 90 ngày → 201", upgrade.status === 201, upgrade.body);
  const upBody = webhookBody({
    transactionCode: upgrade.body?.data?.orderCode,
    amount: upgrade.body?.data?.amount,
  });
  const paid = await sepayWebhook(upBody);
  check("webhook nâng cấp → 200 ack", paid.status === 200 && paid.body?.success === true, paid.body);
  check(
    "SepayWebhookEvent nâng cấp: PROCESSED",
    (await sepayEvent(upBody.id as number))?.status === "PROCESSED"
  );

  const subs = await prisma.membershipSubscription.findMany({
    where: { memberId: member.memberProfileId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  const active = subs.filter((s) => s.status === "ACTIVE");
  const suspended = subs.filter((s) => s.status === "SUSPENDED");
  check(
    "Gói cũ bị SUSPENDED, gói mới ACTIVE PREMIUM",
    active.length === 1 && active[0].tier === "PREMIUM" && suspended.length >= 1,
    { active: active.map((s) => s.tier), suspended: suspended.length }
  );
  const upDays = active[0]
    ? Math.round((active[0].endDate.getTime() - active[0].startDate.getTime()) / DAY)
    : 0;
  const remaining = activeBefore[0]
    ? Math.ceil((activeBefore[0].endDate.getTime() - Date.now()) / DAY)
    : 0;
  check(
    `Thời hạn gói mới = 90 ngày + ngày dư (${upDays} ngày, dư ≈ ${remaining})`,
    upDays >= 90 && Math.abs(upDays - (90 + remaining)) <= 1,
    { upDays, remaining }
  );
  await sleep(200);
  const upgradeNotify = await prisma.notification.findFirst({
    where: { userId: member.id, type: "PAYMENT_SUCCESS", title: { contains: "Nâng cấp" } },
    orderBy: { createdAt: "desc" },
  });
  check("Notification 'Nâng cấp gói thành công!' cho hội viên", Boolean(upgradeNotify), upgradeNotify?.body);
}

/** F) Phân quyền: chỉ MEMBER được checkout; endpoint webhook là công khai (API key); GET cần auth. */
async function scenarioAuthorization(ctx: Ctx, staff: FixtureUser, coach: FixtureUser): Promise<void> {
  section("F) Phân quyền checkout / GET status");
  setSepayEnv({});
  const planId = ctx.plans.membership30.id;

  const asManager = await checkout(ctx.manager.token, planId);
  check("MANAGER checkout → 403 (chỉ MEMBER tự mua)", asManager.status === 403, asManager.body);
  const asStaff = await checkout(staff.token, planId);
  check("STAFF checkout → 403", asStaff.status === 403, asStaff.body);
  const asCoach = await checkout(coach.token, planId);
  check("COACH checkout → 403", asCoach.status === 403, asCoach.body);
  const anonymous = await http("POST", "/payments/sepay/checkout", { body: { planId } });
  check("checkout không token → 401", anonymous.status === 401, anonymous.body);
  const anonGet = await http("GET", "/payments/sepay/00000000-0000-0000-0000-000000000000");
  check("GET /payments/sepay/:id không token → 401", anonGet.status === 401, anonGet.body);
}

// ─── Cleanup + runner ─────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  const memberIds = created.memberProfileIds;
  const payments = memberIds.length
    ? await prisma.payment.findMany({
        where: { memberId: { in: memberIds } },
        select: { id: true },
      })
    : [];
  const paymentIds = payments.map((p) => p.id);

  if (created.userIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
  }
  // SepayWebhookEvent: xoá theo sepayId đã gửi (kể cả webhook mã đơn lạ không có paymentId)
  // và theo paymentId (webhook của fixture) — FK onDelete SetNull nên phải xoá tường minh.
  if (sentSepayIds.length > 0 || paymentIds.length > 0) {
    await prisma.sepayWebhookEvent.deleteMany({
      where: { OR: [{ sepayId: { in: sentSepayIds } }, { paymentId: { in: paymentIds } }] },
    });
  }
  if (memberIds.length > 0) {
    // FK: Invoice → Payment → MembershipSubscription → MemberProfile.
    await prisma.invoice.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.payment.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.membershipSubscription.deleteMany({ where: { memberId: { in: memberIds } } });
  }
  if (created.planIds.length > 0) {
    await prisma.membershipPlan.deleteMany({ where: { id: { in: created.planIds } } });
  }
  if (created.userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
}

async function main(): Promise<void> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`E2E sepay-payment suite — run=${RUN} | api=${baseUrl}/api/v1`);

  const hashed = await hashPassword(PASSWORD);

  try {
    const manager = await createUser("MANAGER", "manager", hashed);
    const coach = await createUser("COACH", "coach", hashed);
    const staff = await createUser("STAFF", "staff", hashed);
    const members: FixtureUser[] = [];
    for (let i = 1; i <= 4; i++) members.push(await createUser("MEMBER", `member${i}`, hashed));

    const membership30 = await createPlan(manager.token, {
      name: `E2E SEPAY M30 ${RUN}`,
      price: 300000,
      durationDays: 30,
      tier: "MEMBERSHIP",
      maxConcurrentClasses: 3,
    });
    const membership7 = await createPlan(manager.token, {
      name: `E2E SEPAY M7 ${RUN}`,
      price: 100000,
      durationDays: 7,
      tier: "MEMBERSHIP",
      maxConcurrentClasses: 3,
    });
    const premium90 = await createPlan(manager.token, {
      name: `E2E SEPAY P90 ${RUN}`,
      price: 900000,
      durationDays: 90,
      tier: "PREMIUM",
      maxConcurrentClasses: 6,
    });

    const freePlan = await prisma.membershipPlan.findFirst({
      where: { tier: "FREE", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!freePlan) throw new Error("Không tìm thấy FREE plan trong DB");

    const ctx: Ctx = { manager, plans: { membership30, membership7, premium90 } };

    await scenarioNotConfigured(members[3], membership30);
    await scenarioCheckoutAndWebhookCore(ctx, members[0], members[1], coach, membership30);
    await scenarioMockMode(ctx, members[1], members[0], coach, manager, membership30);
    await scenarioExpiredPendingAndLate(members[2], membership30);
    await scenarioGuardsAndUpgrade(ctx, members[0], freePlan.id);
    await scenarioAuthorization(ctx, staff, coach);
  } catch (err) {
    failures.push(`Lỗi không mong đợi: ${(err as Error).message}`);
    console.error("\nUNEXPECTED ERROR:", err);
  } finally {
    console.log("\n=== Cleanup ===");
    try {
      await cleanup();
      console.log("  Đã dọn sạch fixture E2E.");
    } catch (err) {
      failures.push(`Cleanup thất bại: ${(err as Error).message}`);
      console.error("  Cleanup thất bại:", err);
    }
    server.close();
    await prisma.$disconnect();
  }

  console.log("\n=== KẾT QUẢ ===");
  console.log(`PASS: ${passed} | FAIL: ${failures.length}`);
  if (failures.length > 0) {
    console.log("\nDanh sách FAIL:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});








