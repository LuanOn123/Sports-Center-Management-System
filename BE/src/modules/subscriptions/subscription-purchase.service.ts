import { activateMemberDue } from "./entitlement.service.js";
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
import { lockMemberSubscription } from "../../utils/dbLocks.js";
import { checkFacilityMemberLimit } from "../facilities/facility-limits.service.js";

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
  /** Gói ACTIVE hiện tại (nếu có). */
  currentActive: MembershipSubscription | null;
  changeType: "UPGRADE" | "RENEW_SAME_TIER" | "DOWNGRADE" | "NEW";
  isUpgrade: boolean;
  oldPlanName: string;
  remainingDays: number;
  calculatedStartDate: Date;
  targetStatus: "ACTIVE" | "SCHEDULED";
  shouldSuspendCurrentActive: boolean;
}

/**
 * ĐỌC-ONLY: kiểm tra luật mua gói theo ma trận chuẩn:
 * - Gia hạn cùng hạng (isSameTier): Tự động nối tiếp vào ngày hết hạn gói cũ (nếu còn hạn), status = SCHEDULED.
 * - Nâng cấp (isUpgrade): Cho phép kích hoạt ngay (status = ACTIVE, suspend gói cũ) hoặc chọn ngày (status = SCHEDULED).
 * - Hạ cấp (isDowngrade): CHỈ được chọn ngày kích hoạt >= ngày hết hạn gói cũ, status = SCHEDULED, gói cũ chạy hết hạn.
 * - Ngày kích hoạt không được quá 60 ngày.
 */
export async function inspectPlanPurchase(
  db: DbClient,
  memberProfileId: string,
  plan: MembershipPlan,
  requestedStartDate?: Date | string,
  now: Date = new Date(),
): Promise<PlanPurchaseContext> {
  if (plan.tier === "FREE") throw new AppError("Gói FREE chỉ được hệ thống tự động cấp.", 400, { code: "FREE_PLAN_NOT_FOR_SALE" });
  const reqDate = requestedStartDate
    ? (requestedStartDate instanceof Date ? requestedStartDate : new Date(requestedStartDate))
    : undefined;

  if (reqDate && !Number.isFinite(reqDate.getTime())) throw new AppError("Ngày kích hoạt gói không hợp lệ.", 400);
  const queued = await db.membershipSubscription.findFirst({ where: { memberId: memberProfileId, status: "SCHEDULED" } });
  if (queued) throw new AppError("Bạn đã có một gói chờ kích hoạt. Hãy xử lý gói đang chờ trước khi mua gói mới.", 409, { code: "SCHEDULED_SUBSCRIPTION_EXISTS" });
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

  const MAX_SCHEDULE_DAYS = 60;

  if (!currentActive || currentActive.tier === "FREE") {
    let calculatedStartDate = now;
    let targetStatus: "ACTIVE" | "SCHEDULED" = "ACTIVE";

    if (reqDate && reqDate.getTime() > now.getTime()) {
      const diffDays = Math.ceil((reqDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_SCHEDULE_DAYS) {
        throw new AppError(`Ngày kích hoạt không được vượt quá ${MAX_SCHEDULE_DAYS} ngày kể từ ngày đăng ký.`, 400);
      }
      calculatedStartDate = reqDate;
      targetStatus = "SCHEDULED";
    }

    return {
      currentActive: currentActive?.tier === "FREE" ? currentActive : null,
      changeType: "NEW",
      isUpgrade: true,
      oldPlanName: currentActive?.plan.name ?? "",
      remainingDays: 0,
      calculatedStartDate,
      targetStatus,
      shouldSuspendCurrentActive: currentActive?.tier === "FREE" && targetStatus === "ACTIVE",
    };
  }

  const currentTierVal = TIER_VALUE[currentActive.tier] ?? 0;
  const newTierVal = TIER_VALUE[plan.tier] ?? 0;
  const isUpgrade = newTierVal > currentTierVal;
  const isSameTier = newTierVal === currentTierVal;
  const isDowngrade = newTierVal < currentTierVal;

  const remainingDays =
    currentActive.endDate > now
      ? Math.ceil((currentActive.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  // Case 1: Gia hạn cùng hạng (isSameTier) -> TỰ ĐỘNG NỐI TIẾP VÀO NGÀY HẾT HẠN GÓI CŨ
  if (isSameTier) {
    // The renewal date is determined by the current period, never silently ignored.
    const effectiveStart = currentActive.endDate > now ? currentActive.endDate : now;
    if (reqDate && Math.abs(+reqDate - +effectiveStart) > 60_000)
      throw new AppError("Gia hạn cùng hạng phải bắt đầu khi gói hiện tại kết thúc.", 400,
        { code: "RENEWAL_START_DATE_CONFLICT", effectiveStartDate: effectiveStart.toISOString() });
    let calculatedStartDate: Date;
    let targetStatus: "ACTIVE" | "SCHEDULED";

    if (currentActive.endDate > now) {
      calculatedStartDate = currentActive.endDate;
      targetStatus = "SCHEDULED";
    } else {
      calculatedStartDate = now;
      targetStatus = "ACTIVE";
    }

    return {
      currentActive,
      changeType: "RENEW_SAME_TIER",
      isUpgrade: false,
      oldPlanName: currentActive.plan.name,
      remainingDays,
      calculatedStartDate,
      targetStatus,
      shouldSuspendCurrentActive: false, // Gói cũ vẫn chạy hết hạn
    };
  }

  // Case 2: Nâng cấp (isUpgrade) -> Cho phép kích hoạt ngay hôm nay hoặc chọn ngày
  if (isUpgrade) {
    let calculatedStartDate = now;
    let targetStatus: "ACTIVE" | "SCHEDULED" = "ACTIVE";
    let shouldSuspendCurrentActive = true;

    if (reqDate && reqDate.getTime() > now.getTime()) {
      const diffDays = Math.ceil((reqDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_SCHEDULE_DAYS) {
        throw new AppError(`Ngày kích hoạt không được vượt quá ${MAX_SCHEDULE_DAYS} ngày kể từ ngày đăng ký.`, 400);
      }
      calculatedStartDate = reqDate;
      targetStatus = "SCHEDULED";
      shouldSuspendCurrentActive = false; // Gói cũ vẫn chạy đến ngày kích hoạt mới
    }

    return {
      currentActive,
      changeType: "UPGRADE",
      isUpgrade: true,
      oldPlanName: currentActive.plan.name,
      remainingDays,
      calculatedStartDate,
      targetStatus,
      shouldSuspendCurrentActive,
    };
  }

  // Case 3: Hạ cấp (isDowngrade) -> CHỈ ĐƯỢC CHỌN NGÀY >= endDate CỦA GÓI CŨ
  if (isDowngrade) {
    let calculatedStartDate: Date;
    let targetStatus: "ACTIVE" | "SCHEDULED";

    if (currentActive.endDate > now) {
      if (reqDate) {
        if (reqDate.getTime() < currentActive.endDate.getTime()) {
          const minDateStr = currentActive.endDate.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
          throw new AppError(
            `Gói hạ cấp chỉ có thể được kích hoạt sau khi gói hiện tại hết hạn (từ ngày ${minDateStr}).`,
            400,
          );
        }
        const diffDays = Math.ceil(
          (reqDate.getTime() - currentActive.endDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays > MAX_SCHEDULE_DAYS) {
          throw new AppError(
            `Ngày kích hoạt không được vượt quá ${MAX_SCHEDULE_DAYS} ngày sau ngày hết hạn gói cũ.`,
            400,
          );
        }
        calculatedStartDate = reqDate;
      } else {
        calculatedStartDate = currentActive.endDate;
      }
      targetStatus = "SCHEDULED";
    } else {
      calculatedStartDate = now;
      targetStatus = "ACTIVE";
    }

    return {
      currentActive,
      changeType: "DOWNGRADE",
      isUpgrade: false,
      oldPlanName: currentActive.plan.name,
      remainingDays,
      calculatedStartDate,
      targetStatus,
      shouldSuspendCurrentActive: false, // Gói cũ vẫn chạy hết hạn
    };
  }

  throw new AppError("Trường hợp đổi gói không xác định", 400);
}

/**
 * `inspectPlanPurchase` + SUSPEND gói ACTIVE cũ nếu cần. BẮT BUỘC gọi trong transaction ghi.
 */
export async function applyPlanSwitchRules(
  tx: Prisma.TransactionClient,
  memberProfileId: string,
  plan: MembershipPlan,
  requestedStartDate?: Date | string,
  now: Date = new Date(),
): Promise<PlanPurchaseContext> {
  await activateMemberDue(tx, memberProfileId, now);
  const context = await inspectPlanPurchase(tx, memberProfileId, plan, requestedStartDate, now);

  if (context.currentActive && (context.shouldSuspendCurrentActive || (context.targetStatus === "ACTIVE" && context.currentActive.endDate <= now))) {
    const suspended = await tx.membershipSubscription.updateMany({
      where: { id: context.currentActive.id, status: "ACTIVE" },
      data: context.currentActive.endDate <= now ? { status: "EXPIRED" } : { status: "SUSPENDED", suspendedAt: now },
    });
    if (suspended.count !== 1) {
      throw new AppError(
        "Gói hiện tại đã thay đổi, vui lòng thử lại.",
        409,
        { code: "SUBSCRIPTION_STATE_CHANGED" },
      );
    }
  }

  return context;
}

export interface ActivateSubscriptionParams {
  memberProfileId: string;
  /** userId của hội viên — nơi gửi notification PAYMENT_SUCCESS. */
  memberUserId?: string;
  /** Tên hội viên cho snapshot BR-25 trên Invoice. */
  memberName?: string | null;
  plan: MembershipPlan;
  /** Payment đã tồn tại (PENDING) — sẽ được chốt SUCCESS + gắn subscriptionId. */
  paymentId: string;
  /** Ngày bắt đầu gói (mặc định = now). Quầy có thể chỉ định tương lai; SePay online luôn dùng now. */
  startDate?: Date | string;
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

  let memberUserId = params.memberUserId;
  if (!memberUserId) {
    const profile = await tx.memberProfile.findUnique({
      where: { id: params.memberProfileId },
      select: { userId: true },
    });
    if (profile) memberUserId = profile.userId;
  }

  // Policy A: serialize theo member TRƯỚC mọi đọc/ghi replacement (purchase/renew/
  // webhook-settlement đồng thời chỉ một thắng; CAS suspend bên dưới là lớp 2).
  await lockMemberSubscription(tx, params.memberProfileId);

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
    params.startDate,
    now,
  );

  const startDate = context.calculatedStartDate;
  const endDate = new Date(startDate);
  // Gói mới CHỈ tính theo durationDays của plan mới — KHÔNG cộng dồn ngày dư từ gói cũ.
  // Ngày dư gói cũ (nếu có) đã được xử lý bởi chính sách hoàn tiền khi hủy.
  endDate.setDate(endDate.getDate() + purchasedPlan.durationDays);

  if (soldPayment.facilityId) {
    await checkFacilityMemberLimit(soldPayment.facilityId, params.memberProfileId, tx);
  }

  const subscription = await tx.membershipSubscription.create({
    data: {
      memberId: params.memberProfileId,
      planId: purchasedPlan.id,
      // ORIGIN facility = nơi thu tiền (Payment.facilityId) — chỉ dùng cho báo cáo/audit;
      // gói vẫn hiệu lực ở mọi facility bất kể cơ sở nào phát hành.
      facilityId: soldPayment.facilityId,
      priceSnapshot: soldPayment.amount,
      tier: purchasedPlan.tier,
      startDate,
      endDate,
      status: context.targetStatus,
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
      // A06: tiền đã thu VÀ quyền đã cấp (kể cả đã lên lịch SCHEDULED).
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

  const startStr = startDate.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  if (context.targetStatus === "SCHEDULED") {
    await enqueueNotification(tx, {
      userId: memberUserId!,
      type: "PAYMENT_SUCCESS",
      title: "Đăng ký gói thành công!",
      body:
        `Gói ${purchasedPlan.name} (${purchasedPlan.tier}) đã thanh toán thành công và sẽ tự động kích hoạt vào ngày ${startStr}.` +
        ` Thời hạn: ${purchasedPlan.durationDays} ngày.`,
      metadata: { subscriptionId: subscription.id, paymentId: payment.id },
    });
  } else if (context.isUpgrade) {
    // F01: ghi outbox TRONG transaction — gửi SAU commit, không mất thông báo khi rollback.
    await enqueueNotification(tx, {
      userId: memberUserId!,
      type: "PAYMENT_SUCCESS",
      title: "Nâng cấp gói thành công!",
      body:
        `Chúc mừng bạn đã nâng cấp thành công từ gói ${context.oldPlanName} lên ${purchasedPlan.name} (${purchasedPlan.tier}).` +
        ` Gói mới có thời hạn ${purchasedPlan.durationDays} ngày kể từ ngày kích hoạt (${startStr}).`,
      metadata: { subscriptionId: subscription.id, paymentId: payment.id },
    });
  } else {
    await enqueueNotification(tx, {
      userId: memberUserId!,
      type: "PAYMENT_SUCCESS",
      title: "Đăng ký gói thành công!",
      body:
        `Gói ${purchasedPlan.name} (${purchasedPlan.tier}) của bạn đã được kích hoạt thành công.` +
        ` Thời hạn: ${purchasedPlan.durationDays} ngày kể từ ngày kích hoạt (${startStr}).`,
      metadata: { subscriptionId: subscription.id, paymentId: payment.id },
    });
  }

  return { subscription, payment, invoice, context };
}
