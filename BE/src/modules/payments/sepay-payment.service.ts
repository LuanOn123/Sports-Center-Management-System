import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";

export interface SePayWebhookPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber: string;
  code?: string | null;
  content?: string | null;
  transferType: string;
  transferAmount: number;
  referenceCode?: string | null;
}

function assertConfigured() {
  if (
    !env.VIETQR_BANK_ID ||
    !env.VIETQR_ACCOUNT_NO ||
    !env.VIETQR_ACCOUNT_NAME
  )
    throw new AppError(
      "VietQR chưa được cấu hình trên máy chủ. Vui lòng liên hệ quản lý.",
      503,
    );
}

function paymentCode() {
  return `SC${Date.now().toString(36)}${randomBytes(3).toString("hex")}`
    .toUpperCase()
    .slice(0, 25);
}

function qrUrl(amount: number, code: string) {
  const bank = encodeURIComponent(env.VIETQR_BANK_ID);
  const account = encodeURIComponent(env.VIETQR_ACCOUNT_NO);
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: code,
    accountName: env.VIETQR_ACCOUNT_NAME,
  });
  return `https://img.vietqr.io/image/${bank}-${account}-compact2.png?${query}`;
}

function sessionResponse(payment: {
  id: string;
  amount: unknown;
  transactionCode: string | null;
  status: string;
  expiresAt: Date | null;
}) {
  const code = payment.transactionCode!;
  const amount = Number(payment.amount);
  return {
    orderId: payment.id,
    requestId: code,
    paymentCode: code,
    amount,
    payUrl: qrUrl(amount, code),
    qrCodeUrl: qrUrl(amount, code),
    message: "Đã tạo yêu cầu chuyển khoản VietQR.",
    status: payment.status,
    expiresAt: payment.expiresAt?.toISOString(),
    bank: {
      bankId: env.VIETQR_BANK_ID,
      accountNo: env.VIETQR_ACCOUNT_NO,
      accountName: env.VIETQR_ACCOUNT_NAME,
    },
  };
}

async function memberAndPlan(userId: string, planId: string) {
  const [member, plan] = await Promise.all([
    prisma.memberProfile.findUnique({
      where: { userId },
      include: { user: true },
    }),
    prisma.membershipPlan.findUnique({ where: { id: planId } }),
  ]);
  if (!member || !member.user.isActive || member.user.role !== "MEMBER")
    throw new AppError("Không tìm thấy hồ sơ hội viên hợp lệ.", 404);
  if (!plan || !plan.isActive)
    throw new AppError("Gói hội viên không tồn tại hoặc đã ngừng bán.", 404);
  if (Number(plan.price) <= 0)
    throw new AppError("Gói miễn phí không cần thanh toán VietQR.", 400);

  const current = await prisma.membershipSubscription.findFirst({
    where: { memberId: member.id, status: "ACTIVE" },
    include: { plan: true },
  });
  if (current) {
    const tier: Record<string, number> = {
      FREE: 0,
      MEMBERSHIP: 1,
      PREMIUM: 2,
    };
    if ((tier[plan.tier] ?? 0) < (tier[current.tier] ?? 0))
      throw new AppError(
        "Không thể mua gói thấp hơn hạng hội viên hiện tại.",
        400,
      );
  }
  return { member, plan };
}

export async function createVietQrPayment(planId: string, userId: string) {
  assertConfigured();
  const { member, plan } = await memberAndPlan(userId, planId);
  const now = new Date();
  await prisma.payment.updateMany({
    where: {
      memberId: member.id,
      provider: "SEPAY",
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: { status: "FAILED" },
  });

  const existing = await prisma.payment.findFirst({
    where: {
      memberId: member.id,
      planId: plan.id,
      provider: "SEPAY",
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return sessionResponse(existing);

  const expiresAt = new Date(
    now.getTime() + env.VIETQR_PAYMENT_TTL_MINUTES * 60_000,
  );
  const payment = await prisma.payment.create({
    data: {
      memberId: member.id,
      planId: plan.id,
      amount: plan.price,
      method: "BANK_TRANSFER",
      status: "PENDING",
      transactionCode: paymentCode(),
      provider: "SEPAY",
      expiresAt,
      note: `Thanh toán VietQR cho gói ${plan.name}`,
      createdById: userId,
    },
  });
  return sessionResponse(payment);
}

export async function getVietQrPaymentStatus(
  orderId: string,
  userId: string,
) {
  const member = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!member) throw new AppError("Không tìm thấy hồ sơ hội viên.", 404);
  let payment = await prisma.payment.findFirst({
    where: { id: orderId, memberId: member.id, provider: "SEPAY" },
  });
  if (!payment) throw new AppError("Không tìm thấy giao dịch VietQR.", 404);
  if (
    payment.status === "PENDING" &&
    payment.expiresAt &&
    payment.expiresAt <= new Date()
  )
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
  return {
    orderId: payment.id,
    status: payment.status,
    resultCode:
      payment.status === "PENDING" ? null : payment.status === "SUCCESS" ? 0 : 1,
    message:
      payment.status === "SUCCESS"
        ? "Chuyển khoản thành công. Gói hội viên đã được kích hoạt."
        : payment.status === "FAILED"
          ? "Giao dịch đã hết hạn hoặc không thành công."
          : "Đang chờ ngân hàng xác nhận chuyển khoản.",
    subscriptionId: payment.subscriptionId ?? undefined,
  };
}

export function assertSePayWebhookAuthorization(value?: string) {
  if (!env.SEPAY_WEBHOOK_API_KEY)
    throw new AppError("SePay webhook chưa được cấu hình.", 503);
  const expected = Buffer.from(`Apikey ${env.SEPAY_WEBHOOK_API_KEY}`);
  const received = Buffer.from(value || "");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new AppError("SePay webhook không hợp lệ.", 401);
}

function webhookPaymentCode(payload: SePayWebhookPayload) {
  const candidate = `${payload.code || ""} ${payload.content || ""}`
    .toUpperCase()
    .match(/SC[A-Z0-9]{8,23}/)?.[0];
  return candidate || null;
}

export async function processSePayWebhook(payload: SePayWebhookPayload) {
  assertConfigured();
  if (payload.transferType.toLowerCase() !== "in")
    return { processed: false, reason: "IGNORED_OUTGOING_TRANSACTION" };
  if (
    payload.accountNumber.replace(/\s/g, "") !==
    env.VIETQR_ACCOUNT_NO.replace(/\s/g, "")
  )
    return { processed: false, reason: "ACCOUNT_MISMATCH" };

  const code = webhookPaymentCode(payload);
  if (!code) return { processed: false, reason: "PAYMENT_CODE_NOT_FOUND" };
  const payment = await prisma.payment.findUnique({
    where: { transactionCode: code },
    include: { plan: true, member: { include: { user: true } } },
  });
  if (!payment || payment.provider !== "SEPAY")
    return { processed: false, reason: "PAYMENT_NOT_FOUND" };
  if (payment.status === "SUCCESS")
    return { processed: true, duplicate: true, orderId: payment.id };
  if (payment.status !== "PENDING")
    return { processed: false, reason: "PAYMENT_NOT_PENDING" };
  if (payment.expiresAt && payment.expiresAt <= new Date())
    return { processed: false, reason: "PAYMENT_EXPIRED" };
  if (Number(payment.amount) !== Number(payload.transferAmount))
    return { processed: false, reason: "AMOUNT_MISMATCH" };
  if (!payment.plan)
    throw new AppError("Giao dịch không gắn với gói hội viên.", 409);

  const providerTransactionId = `SEPAY:${String(payload.id)}`;
  const activated = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.payment.findUnique({
      where: { providerTransactionId },
    });
    if (duplicate && duplicate.id !== payment.id)
      return { duplicate: true, subscriptionId: duplicate.subscriptionId };

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { providerTransactionId },
    });
    if (!claimed.count) {
      const current = await tx.payment.findUnique({ where: { id: payment.id } });
      return {
        duplicate: true,
        subscriptionId: current?.subscriptionId ?? null,
      };
    }

    const now = new Date();
    const active = await tx.membershipSubscription.findFirst({
      where: { memberId: payment.memberId, status: "ACTIVE" },
      include: { plan: true },
    });
    let remainingDays = 0;
    if (active) {
      const tier: Record<string, number> = {
        FREE: 0,
        MEMBERSHIP: 1,
        PREMIUM: 2,
      };
      if ((tier[payment.plan!.tier] ?? 0) < (tier[active.tier] ?? 0))
        throw new AppError(
          "Không thể kích hoạt gói thấp hơn hạng hiện tại.",
          409,
        );
      if (active.endDate > now)
        remainingDays = Math.ceil(
          (active.endDate.getTime() - now.getTime()) / 86_400_000,
        );
      await tx.membershipSubscription.update({
        where: { id: active.id },
        data: { status: "SUSPENDED", suspendedAt: now },
      });
    }

    const endDate = new Date(now);
    endDate.setDate(
      endDate.getDate() + payment.plan!.durationDays + remainingDays,
    );
    const subscription = await tx.membershipSubscription.create({
      data: {
        memberId: payment.memberId,
        planId: payment.plan!.id,
        tier: payment.plan!.tier,
        startDate: now,
        endDate,
        status: "ACTIVE",
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        subscriptionId: subscription.id,
        status: "SUCCESS",
        paidAt: now,
      },
    });
    await tx.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`,
        memberId: payment.memberId,
        paymentId: payment.id,
        subtotal: payment.amount,
        discount: 0,
        total: payment.amount,
        status: "ISSUED",
        issuedAt: now,
        memberName: payment.member.user.fullName,
        planName: payment.plan!.name,
        planTier: payment.plan!.tier,
      },
    });
    return { duplicate: false, subscriptionId: subscription.id };
  });

  if (!activated.duplicate)
    createNotification(
      payment.member.userId,
      "PAYMENT_SUCCESS",
      "Chuyển khoản thành công!",
      `Gói ${payment.plan.name} đã được kích hoạt sau khi SePay xác nhận giao dịch.`,
      { metadata: { paymentId: payment.id } },
    ).catch(() => {});

  return {
    processed: true,
    duplicate: activated.duplicate,
    orderId: payment.id,
    subscriptionId: activated.subscriptionId,
  };
}
