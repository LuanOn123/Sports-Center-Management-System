// constants/sepayReview.ts
// Chữ của màn "đã nhận tiền nhưng gói chưa kích hoạt" (web: shared/SepayCheckout, nhánh requiresReview). Tách khỏi constants/payment
// để lib/payment (hàm thuần, chạy cả trong test) không kéo theo các hằng chỉ dùng được trong app (__DEV__).

/** Lý do đối soát do BE đặt khi tiền về sau lúc đơn đã hết hạn hoặc đã đóng (reviewReason của đơn SePay) */
export const SEPAY_LATE_PAYMENT_REASON = 'LATE_PAYMENT';

export const SEPAY_REVIEW_TEXT = {
  title: 'Đã nhận thanh toán — đang đối soát',
  late: (orderCode: string) =>
    `Trung tâm đã nhận tiền cho đơn ${orderCode} sau khi đơn hết hạn hoặc đã đóng. Vui lòng giữ biên lai và liên hệ trung tâm để đối soát hoàn tiền.`,
  notActivated: (orderCode: string) =>
    `Trung tâm đã nhận tiền cho đơn ${orderCode}. Gói chưa được kích hoạt; vui lòng giữ biên lai và liên hệ trung tâm.`,
  note: (reason: string) => ` Ghi chú: ${reason}`,
  checkAgain: 'Kiểm tra lại',
  close: 'Đóng',
} as const;
