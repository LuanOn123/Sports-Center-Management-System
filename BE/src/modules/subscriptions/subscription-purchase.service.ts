import {
  MembershipPlan,
  MembershipSubscription,
  MemberTier,
  Prisma,
  Payment,
  Invoice,
} from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { enqueueNotification } from "../notifications/outbox.service.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

/** Thứ tự hạng gói — dùng để chặn hạ hạng khi mua gói mới. */
export const TIER_VALUE: Record<string, number> = {
  FREE: 0,
  MEMBERSHIP: 1,
  PREMIUM: 2,
};

/** Số tiền phải thu của một gói (VND, số nguyên) — nguồn duy nhất cho mọi kênh thanh toán. */
export function planAmount(plan: MembershipPlan): number {
  return Math.round(Number(plan.price));
}

export interface PlanPurchaseContext {
  /** Gói ACTIVE hiện tại (nếu có) — sẽ bị SUSPEND khi gói mới được kích hoạt. */
  currentActive: MembershipSubscription | null;
  isUpgrade: boolean;
  oldPlanName: string;
  /**
   * Số ngày còn dư của gói TRẢ PHÍ cũ (MEMBERSHIP/PREMIUM) — chỉ dùng cho thông tin/hoàn tiền.
   * KHÔNG còn cộng dồn vào gói mới. Gói FREE hệ thống luôn trả 0.
   */
  remainingDays: number;
}

/**
 * ĐỌC-ONLY: kiểm tra luật mua gói so với gói đang ACTIVE và tính context.
 *
 * - Không cho hạ hạng: tier mới thấp hơn tier ACTIVE ⇒ 400.
 * - Cùng hạng: không cho mua gói ít ngày hơn gói đang dùng ⇒ 400.
 * - `remainingDays` CHỈ dùng cho thông tin (notification/hoàn tiền), KHÔNG cộng dồn vào gói mới.
 *   Gói FREE hệ thống (auto-provision, durationDays = 3650) luôn ⇒ 0.
 *
 * Dùng để "fail fast" trước khi tạo giao dịch online (không tạo Payment rác),
 * còn lúc chốt giao dịch thì `applyPlanSwitchRules` chạy lại trong transaction.
 */
export async function inspectPlanPurchase(
  db: DbClient,
  memberProfileId: string,
  plan: MembershipPlan,
  now: Date = new Date(),
): Promise<PlanPurchaseContext> {
  const currentActive = await db.membershipSubscription.findFirst({
    where: { memberId: memberProfileId, status: "ACTIVE" },
    include: {
      plan: true,
      payments: {
        where: { paidAt: { not: null } },
        orderBy: { paidAt: "asc" },
        take: 1,
        select: { durationDaysSnapshot: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!currentActive) {
    return {
      currentActive: null,
      isUpgrade: false,
      oldPlanName: "",
      remainingDays: 0,
    };
  }

  const currentTierVal = TIER_VALUE[currentActive.tier] ?? 0;
  const newTierVal = TIER_VALUE[plan.tier] ?? 0;

  if (newTierVal < currentTierVal) {
    throw new AppError(
      "Không thể mua gói thấp hơn hạng hiện tại. Bạn chỉ có thể nâng cấp.",
      400,
    );
  }
  const soldDuration =
    currentActive.payments?.[0]?.durationDaysSnapshot ??
    Math.max(
      1,
      Math.round(
        (currentActive.endDate.getTime() - currentActive.startDate.getTime()) /
          86400000,
      ),
    );
  if (newTierVal === currentTierVal && plan.durationDays < soldDuration) {
    throw new AppError(
      `Bạn đang dùng gói ${soldDuration} ngày. Không thể mua gói ${plan.durationDays} ngày cùng hạng.`,
      400,
    );
  }

  // FREE là gói hệ thống cấp tự động khi mở tài khoản (durationDays = 3650 ngày) — thời hạn
  // này KHÔNG phải thời gian hội viên đã trả tiền nên TUYỆT ĐỐI không cộng dồn.
  // Chỉ cộng dồn ngày dư thật của gói trả phí (MEMBERSHIP/PREMIUM) đang ACTIVE.
  const remainingDays =
    currentActive.tier !== "FREE" && currentActive.endDate > now
      ? Math.ceil(
          (currentActive.endDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  return {
    currentActive,
    isUpgrade: newTierVal > currentTierVal,
    oldPlanName: currentActive.plan.name,
    remainingDays,
  };
}

/**
 * `inspectPlanPurchase` + SUSPEND gói ACTIVE cũ. BẮT BUỘC gọi trong transaction ghi
 * (thứ tự: kiểm tra luật → suspend gói cũ → tạo gói mới).
 */
export async function applyPlanSwitchRules(
  tx: Prisma.TransactionClient,
  memberProfileId: string,
  plan: MembershipPlan,
  now: Date = new Date(),
): Promise<PlanPurchaseContext> {
  const context = await inspectPlanPurchase(tx, memberProfileId, plan, now);

  if (context.currentActive) {
    await tx.membershipSubscription.update({
      where: { id: context.currentActive.id },
      data: { status: "SUSPENDED", suspendedAt: now },
    });
  }

  return context;
}

export interface ActivateSubscriptionParams {
  memberProfileId: string;
  /** userId của hội viên — nơi gửi notification PAYMENT_SUCCESS. */
  memberUserId: string;
  /** Tên hội viên cho snapshot BR-25 trên Invoice. */
  memberName?: string | null;
  plan: MembershipPlan;
  /** Payment đã tồn tại (PENDING) — sẽ được chốt SUCCESS + gắn subscriptionId. */
  paymentId: string;
  /** Ngày bắt đầu gói (mặc định = now). Quầy có thể chỉ định tương lai; SePay online luôn dùng now. */
  startDate?: Date;
  now?: Date;
  /**
   * A07 — snapshot điều khoản gói tại THỜI ĐIỂM TẠO ĐƠN (đối với SePay: lúc tạo QR).
   * Khi có, luật đổi gói + thời hạn + tier + hóa đơn + quota dùng snapshot thay cho cấu hình
   * plan hiện tại; plan có thể đã bị sửa trong lúc chờ chuyển khoản.
   */
  optionSnapshot?: {
    planName?: string | null;
    tier?: MemberTier | null;
    durationDays?: number | null;
    maxConcurrentClasses?: number | null;
  } | null;
}

/**
 * CHỐT GIAO DỊCH MUA GÓI — dùng chung cho quầy (CASH/BANK_TRANSFER) và SePay online.
 *
 * Trong CÙNG transaction:
 * 1. Áp luật đổi gói (chặn hạ hạng) + suspend gói ACTIVE cũ (`applyPlanSwitchRules`).
 * 2. Tạo `MembershipSubscription` ACTIVE: startDate = now,
 *    endDate = now + durationDays (KHÔNG cộng dồn ngày dư từ gói cũ).
 * 3. Cập nhật Payment → `SUCCESS`, `paidAt`, gắn `subscriptionId`.
 * 4. Tạo Invoice kèm snapshot BR-25 (memberName/planName/planTier).
 * 5. Gửi notification `PAYMENT_SUCCESS` (fire-and-forget, không làm fail transaction).
 */
export async function activateSubscriptionForPayment(
  tx: Prisma.TransactionClient,
  params: ActivateSubscriptionParams,
): Promise<{
  subscription: MembershipSubscription & { plan: MembershipPlan };
  payment: Payment;
  invoice: Invoice;
  context: PlanPurchaseContext;
}> {
  const soldPayment = await tx.payment.findUniqueOrThrow({
    where: { id: params.paymentId },
  });
  // Gateway callbacks use the persisted order's facility, without a caller header.
  if (!requestContext.getStore()?.facilityId)
    return requestContext.run(
      {
        ...requestContext.getStore(),
        facilityId: soldPayment.facilityId,
        actorId: "system:payment-activation",
        reason: "Activate paid order",
      },
      () => activateSubscriptionForPayment(tx, params),
    );
  const now = params.now ?? new Date();
  const { plan } = params;
  const snapshot = params.optionSnapshot ?? null;

  // A07: chốt tiền theo ĐÚNG offer đã bán lúc tạo đơn — plan có thể đã bị sửa trong lúc chờ CK.
  const purchasedPlan: MembershipPlan = {
    ...plan,
    name: snapshot?.planName ?? plan.name,
    tier: snapshot?.tier ?? plan.tier,
    durationDays: snapshot?.durationDays ?? plan.durationDays,
  };
  const purchasedQuota =
    snapshot?.maxConcurrentClasses ?? plan.maxConcurrentClasses;

  const context = await applyPlanSwitchRules(
    tx,
    params.memberProfileId,
    purchasedPlan,
    now,
  );

  const startDate = params.startDate ?? now;
  const endDate = new Date(startDate);
  // Gói mới CHỈ tính theo durationDays của plan mới — KHÔNG cộng dồn ngày dư từ gói cũ.
  // Ngày dư gói cũ (nếu có) đã được xử lý bởi chính sách hoàn tiền khi hủy.
  endDate.setDate(endDate.getDate() + purchasedPlan.durationDays);

  const subscription = await tx.membershipSubscription.create({
    data: {
      memberId: params.memberProfileId,
      planId: purchasedPlan.id,
      facilityId: soldPayment.facilityId,
      priceSnapshot: soldPayment.amount,
      tier: purchasedPlan.tier,
      startDate,
      endDate,
      status: "ACTIVE",
      // Quota đã bán cho kỳ này — không đổi khi Manager sửa plan sau đó.
      maxConcurrentClassesSnapshot: purchasedQuota,
    },
    include: { plan: true },
  });

  const payment = await tx.payment.update({
    where: { id: params.paymentId },
    data: {
      status: "SUCCESS",
      paidAt: now,
      subscriptionId: subscription.id,
      // A06: tiền đã thu VÀ quyền đã cấp.
      activationStatus: "ACTIVATED",
      // A07: lưu snapshot trên payment (mua tại quầy chưa từng ghi lúc tạo đơn).
      planNameSnapshot: purchasedPlan.name,
      planTierSnapshot: purchasedPlan.tier,
      durationDaysSnapshot: purchasedPlan.durationDays,
      maxConcurrentClassesSnapshot: purchasedQuota,
    },
  });

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      memberId: params.memberProfileId,
      paymentId: payment.id,
      // A07: hóa đơn phản ánh đúng SỐ TIỀN ĐÃ THU (không đọc giá plan hiện tại).
      subtotal: Number(payment.amount),
      discount: 0,
      total: Number(payment.amount),
      status: "ISSUED",
      issuedAt: now,
      memberName: params.memberName ?? null,
      planName: purchasedPlan.name,
      planTier: purchasedPlan.tier,
    },
  });

  if (context.isUpgrade) {
    // F01: ghi outbox TRONG transaction — gửi SAU commit, không mất thông báo khi rollback.
    await enqueueNotification(tx, {
      userId: params.memberUserId,
      type: "PAYMENT_SUCCESS",
      title: "Nâng cấp gói thành công!",
      body:
        `Chúc mừng bạn đã nâng cấp thành công từ gói ${context.oldPlanName} lên ${purchasedPlan.name} (${purchasedPlan.tier}).` +
        ` Gói mới có thời hạn ${purchasedPlan.durationDays} ngày kể từ ngày kích hoạt.`,
      metadata: { subscriptionId: subscription.id, paymentId: payment.id },
    });
  } else {
    await enqueueNotification(tx, {
      userId: params.memberUserId,
      type: "PAYMENT_SUCCESS",
      title: "Đăng ký gói thành công!",
      body:
        `Gói ${purchasedPlan.name} (${purchasedPlan.tier}) của bạn đã được kích hoạt thành công.` +
        ` Thời hạn: ${purchasedPlan.durationDays} ngày kể từ ngày kích hoạt.`,
      metadata: { subscriptionId: subscription.id, paymentId: payment.id },
    });
  }

  return { subscription, payment, invoice, context };
}
