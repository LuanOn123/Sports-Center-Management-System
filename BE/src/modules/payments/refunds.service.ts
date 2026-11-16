import { Prisma } from "@prisma/client";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { prisma } from "../../config/prisma.js";
import { lockMemberSubscription, lockPaymentWebhook } from "../../utils/dbLocks.js";
import { revokeSubscriptionBookings } from "../subscriptions/entitlement.service.js";
import { notifyReceptionistsAboutRefund } from "../notifications/notifications.service.js";

/** Yêu cầu hoàn tiền từ Member hoặc Admin, hỗ trợ kiểm tra điều kiện gói tập, ghi AuditLog và báo cho Lễ tân cơ sở. */
export async function requestPaymentRefund(id: string, reason: string, user: { id: string; role: string }) {
  return prisma.$transaction(async tx => {
    await lockPaymentWebhook(tx, id);
    const payment = await tx.payment.findUnique({
      where: { id },
      include: {
        member: { include: { user: true } },
        subscription: { include: { plan: true } },
      },
    });
    if (!payment) throw new AppError("Payment not found", 404);
    await lockMemberSubscription(tx, payment.memberId);

    if (user.role === "MEMBER" && payment.member?.userId !== user.id) {
      throw new AppError("Forbidden: Bạn chỉ có thể yêu cầu hoàn tiền cho giao dịch của chính mình.", 403);
    }

    if (payment.status !== "SUCCESS") {
      throw new AppError("Chỉ có thể yêu cầu hoàn tiền cho giao dịch đã thanh toán thành công.", 409);
    }

    if (payment.refundRequestedAt) {
      if (user.role === "ADMIN") {
        return payment;
      }
      throw new AppError("Giao dịch đã có yêu cầu hoàn tiền đang chờ xử lý.", 409, { code: "REFUND_ALREADY_REQUESTED" });
    }

    let refundAmount = Number(payment.amount);

    if (payment.subscription) {
      const sub = payment.subscription;
      const now = new Date();
      if (sub.status === "SCHEDULED") {
        refundAmount = Number(payment.amount);
        await tx.membershipSubscription.update({
          where: { id: sub.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        await revokeSubscriptionBookings(tx, { id: sub.id, memberId: payment.memberId }, now);
      } else if (sub.status === "ACTIVE") {
        const msLeft = sub.endDate.getTime() - now.getTime();
        const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        const REFUND_THRESHOLD_DAYS = 15;
        const REFUND_RATE = 0.3;
        if (daysLeft > REFUND_THRESHOLD_DAYS) {
          refundAmount = Math.round(Number(payment.amount) * REFUND_RATE);
        } else {
          throw new AppError(`Không đủ điều kiện hoàn tiền: Gói tập còn ${daysLeft} ngày sử dụng (chính sách yêu cầu > 15 ngày).`, 400);
        }
        await tx.membershipSubscription.update({
          where: { id: sub.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        await revokeSubscriptionBookings(tx, { id: sub.id, memberId: payment.memberId }, now);
      } else {
        throw new AppError(`Gói tập đang ở trạng thái ${sub.status}, không thể yêu cầu hoàn tiền.`, 400);
      }
    }

    await requestRefund(tx, payment, refundAmount, reason);

    const updated = await tx.payment.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        facilityId: payment.facilityId,
        actorId: user.id,
        entity: "Payment",
        entityId: id,
        action: "requestRefund",
        reason,
        before: { status: payment.status, refundRequestedAt: null },
        after: { status: updated.status, refundRequestedAmount: Number(updated.refundRequestedAmount) },
      },
    });

    setImmediate(async () => {
      try {
        await notifyReceptionistsAboutRefund({
          facilityId: payment.facilityId,
          paymentId: payment.id,
          memberUserId: payment.member?.user?.id,
          memberName: payment.member?.user?.fullName,
          refundAmount,
          reason,
        });
      } catch (e) {
        console.error("Failed to notify receptionists about refund:", e);
      }
    });

    return updated;
  });
}

/** Admin-only route: full refund approval for collected online funds with no issued rights. */
export async function requestUnactivatedRefund(id: string, reason: string, actorId: string) {
  return prisma.$transaction(async tx => {
    await lockPaymentWebhook(tx, id);
    const payment = await tx.payment.findUnique({ where: { id } });
    if (!payment) throw new AppError("Payment not found", 404);
    await lockMemberSubscription(tx, payment.memberId);
    if (payment.status !== "SUCCESS" || payment.gateway !== "SEPAY" || payment.subscriptionId ||
      payment.activationStatus !== "REQUIRES_REVIEW")
      throw new AppError("Chỉ duyệt hoàn ngoại lệ cho giao dịch SePay đã thu nhưng chưa cấp gói và đang cần đối soát.", 409);
    if (payment.refundRequestedAt) return payment;
    await requestRefund(tx, payment, Number(payment.amount), reason);
    const updated = await tx.payment.update({ where: { id }, data: { reviewedAt: new Date(), reviewedById: actorId } });
    await tx.auditLog.create({ data: { facilityId: payment.facilityId, actorId, entity: "Payment", entityId: id,
      action: "approveUnactivatedRefund", reason,
      before: { status: payment.status, refundRequestedAt: null },
      after: { status: updated.status, refundRequestedAmount: Number(updated.refundRequestedAmount) } } });
    return updated;
  });
}

/** Request is not evidence that money has actually been returned. */
export async function requestRefund(
  tx: Prisma.TransactionClient,
  payment: { id: string; facilityId?: string | null },
  amount: number,
  reason: string,
) {
  await requestContext.run(
    {
      ...requestContext.getStore(),
      facilityId: payment.facilityId ?? undefined,
    },
    async () => {
      const original = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      if (
        !original ||
        original.status !== "SUCCESS" ||
        amount <= 0 ||
        amount > Number(original.amount)
      )
        throw new AppError(
          "Giao dịch không đủ điều kiện yêu cầu hoàn tiền.",
          409,
        );
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: "SUCCESS", refundRequestedAt: null },
        data: {
          refundRequestedAt: new Date(),
          refundRequestedAmount: amount,
          refundReason: reason,
        },
      });
      // Never promise a refund amount that was not recorded (already requested or state changed).
      if (changed.count !== 1)
        throw new AppError(
          "Giao dịch đã có yêu cầu hoàn tiền hoặc vừa đổi trạng thái. Vui lòng tải lại.",
          409,
          { code: "REFUND_ALREADY_REQUESTED" },
        );
    },
  );
}
