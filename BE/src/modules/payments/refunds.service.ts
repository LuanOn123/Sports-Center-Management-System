import { Prisma } from "@prisma/client";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { prisma } from "../../config/prisma.js";
import { lockMemberSubscription, lockPaymentWebhook } from "../../utils/dbLocks.js";
import { activateMemberDue, revokeSubscriptionBookings } from "../subscriptions/entitlement.service.js";
import { findRefundReceptionist, notifyReceptionistsAboutRefund } from "../notifications/notifications.service.js";

/** Cancel only an unpaid refund request. Entitlements cancelled by the request stay cancelled. */
export async function cancelPaymentRefund(id: string, reason: string, user: { id: string; role: string }) {
  if (user.role !== "RECEPTIONIST") throw new AppError("Bạn không có quyền hủy yêu cầu hoàn tiền.", 403);
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3 || trimmedReason.length > 1000) {
    throw new AppError("Lý do hủy phải từ 3 đến 1000 ký tự.", 400);
  }
  return prisma.$transaction(async tx => {
    // The payout confirmation uses this same lock, so only one decision can succeed.
    await lockPaymentWebhook(tx, id);
    const payment = await tx.payment.findUnique({ where: { id }, include: { member: true } });
    if (!payment) throw new AppError("Không tìm thấy giao dịch.", 404);
    if (!requestContext.getStore()?.facilityId || payment.facilityId !== requestContext.getStore()?.facilityId) {
      throw new AppError("Bạn chỉ được xử lý yêu cầu hoàn tại cơ sở đang phụ trách.", 403);
    }
    if (payment.status !== "SUCCESS" || !payment.refundRequestedAt) {
      throw new AppError("Yêu cầu đã được xử lý hoặc không còn chờ hoàn tiền. Vui lòng tải lại.", 409);
    }
    const changed = await tx.payment.updateMany({
      where: { id, status: "SUCCESS", refundRequestedAt: payment.refundRequestedAt },
      data: { refundRequestedAt: null, refundRequestedAmount: null, refundReason: null },
    });
    if (changed.count !== 1) throw new AppError("Yêu cầu vừa được xử lý. Vui lòng tải lại.", 409);
    await tx.auditLog.create({ data: {
      facilityId: payment.facilityId, actorId: user.id, entity: "Payment", entityId: id,
      action: "cancelRefund", reason: trimmedReason,
      before: { refundRequestedAt: payment.refundRequestedAt.toISOString(), refundRequestedAmount: Number(payment.refundRequestedAmount), refundReason: payment.refundReason },
      after: { status: "SUCCESS", refundRequestedAt: null, refundRequestedAmount: null },
    } });
    await tx.notification.create({ data: {
      userId: payment.member.userId, type: "GENERAL", title: "Yêu cầu hoàn tiền đã bị hủy",
      body: `Yêu cầu hoàn tiền cho giao dịch #${id} đã bị lễ tân hủy. Lý do: ${trimmedReason}`,
      reason: trimmedReason,
      metadata: { action: "REFUND_CANCELLED", paymentId: id, facilityId: payment.facilityId, reason: trimmedReason },
    } });
    return tx.payment.findUniqueOrThrow({ where: { id } });
  });
}

/** Yêu cầu hoàn tiền từ Member hoặc Admin, hỗ trợ kiểm tra điều kiện gói tập, ghi AuditLog và báo cho Lễ tân cơ sở. */
export async function requestPaymentRefund(id: string, reason: string, user: { id: string; role: string }) {
  const result = await prisma.$transaction(async tx => {
    await lockPaymentWebhook(tx, id);
    const order = await tx.payment.findUnique({ where: { id }, select: { memberId: true } });
    if (!order) throw new AppError("Payment not found", 404);
    await lockMemberSubscription(tx, order.memberId);
    const payment = await tx.payment.findUnique({
      where: { id },
      include: {
        member: { include: { user: true } },
        subscription: { include: { plan: true } },
      },
    });
    if (!payment) throw new AppError("Payment not found", 404);

    if (user.role === "MEMBER" && payment.member?.userId !== user.id) {
      throw new AppError("Forbidden: Bạn chỉ có thể yêu cầu hoàn tiền cho giao dịch của chính mình.", 403);
    }
    if (payment.status !== "SUCCESS") {
      throw new AppError("Chỉ có thể yêu cầu hoàn tiền cho giao dịch đã thanh toán thành công.", 409);
    }
    if (!payment.subscription) {
      if (payment.gateway !== "SEPAY" || payment.activationStatus !== "REQUIRES_REVIEW") {
        throw new AppError("Giao dịch chưa cấp gói không đủ điều kiện duyệt hoàn ngoại lệ.", 409);
      }
      if (user.role !== "ADMIN") {
        throw new AppError("Giao dịch chưa cấp gói cần quản trị viên đối soát và duyệt hoàn.", 403);
      }
    }

    if (payment.refundRequestedAt) {
      if (user.role === "ADMIN") {
        return { payment, receptionist: await findRefundReceptionist(payment.facilityId, tx), notification: null };
      }
      throw new AppError("Giao dịch đã có yêu cầu hoàn tiền đang chờ xử lý.", 409, { code: "REFUND_ALREADY_REQUESTED" });
    }

    let refundAmount = Number(payment.amount);

    if (payment.subscription) {
      const now = new Date();
      if (payment.subscription.status === "SCHEDULED" && payment.subscription.startDate <= now) {
        await activateMemberDue(tx, payment.memberId, now);
      }
      const sub = await tx.membershipSubscription.findUniqueOrThrow({ where: { id: payment.subscription.id } });
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

    const receptionist = await findRefundReceptionist(payment.facilityId, tx);
    return {
      payment: updated,
      receptionist,
      notification: {
        facilityId: payment.facilityId,
        paymentId: payment.id,
        memberUserId: payment.member?.user?.id,
        memberName: payment.member?.user?.fullName,
        refundAmount,
        reason,
        receptionist,
      },
    };
  });
  if (result.notification) {
    void notifyReceptionistsAboutRefund(result.notification).catch((error) => {
      console.error("Failed to notify receptionists about refund:", error);
    });
  }
  return { ...result.payment, refundReceptionist: result.receptionist };
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
        !Number.isSafeInteger(amount) ||
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
