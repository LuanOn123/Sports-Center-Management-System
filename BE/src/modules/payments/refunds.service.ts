import { Prisma } from "@prisma/client";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";

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
