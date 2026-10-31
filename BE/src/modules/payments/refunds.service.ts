import { Prisma } from "@prisma/client";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { prisma } from "../../config/prisma.js";
import { lockMemberSubscription, lockPaymentWebhook } from "../../utils/dbLocks.js";

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
