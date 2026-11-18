// constants/refund.ts
// Chữ, giới hạn và dữ liệu cần tải lại của "Yêu cầu hoàn tiền" một giao dịch (web: MemberRefundDialog ở pages/member/PaymentsPage)

import { SELF_CANCEL_REFUND_THRESHOLD_DAYS } from './membership';

/** Lý do yêu cầu hoàn tiền dài 3–1000 ký tự (BE: z.string().trim().min(3).max(1000)) */
export const REFUND_REASON_MIN_LENGTH = 3;
export const REFUND_REASON_MAX_LENGTH = 1000;

/** Chỉ giao dịch đã thanh toán thành công mới được xin hoàn tiền */
export const REFUND_ELIGIBLE_PAYMENT_STATUS = 'SUCCESS';

/** Mã giao dịch hiển thị cho người dùng: 8 ký tự đầu của id (web: payment.id.slice(0, 8)) */
export const PAYMENT_CODE_LENGTH = 8;

/** Tên gọi khi thông báo không kèm tên lễ tân (web: "lễ tân") */
export const REFUND_RECEPTIONIST_FALLBACK = 'lễ tân';

export const REFUND_TEXT = {
  action: 'Yêu cầu hoàn tiền',
  title: 'Yêu cầu hoàn tiền',
  summary: (code: string, amount: string) => `Bạn đang yêu cầu hoàn tiền cho giao dịch mã #${code} - Số tiền thanh toán: ${amount}.`,
  policy: (days: number) =>
    `Lưu ý: Nếu giao dịch gắn với gói tập đang hoạt động, quyền lợi tập luyện sẽ được thu hồi và số tiền hoàn sẽ tính theo quy định (trên ${days} ngày sử dụng).`,
  reasonLabel: 'Lý do yêu cầu hoàn tiền',
  reasonPlaceholder: 'Nhập lý do bạn muốn hoàn tiền...',
  reasonTooShort: `Lý do cần ít nhất ${REFUND_REASON_MIN_LENGTH} ký tự.`,
  counter: (length: number) => `${length}/${REFUND_REASON_MAX_LENGTH}`,
  cancel: 'Hủy',
  submit: 'Gửi yêu cầu hoàn tiền',
  submitting: 'Đang gửi…',
  /** Dùng khi BE không kèm câu báo thành công */
  doneFallback: 'Đã gửi yêu cầu hoàn tiền thành công!',
  receptionist: 'Lễ tân phụ trách hoàn tiền',
  chatWithReceptionist: 'Nhắn tin với lễ tân',
  noReceptionist: 'Không có lễ tân phụ trách hoàn tiền. Vui lòng liên hệ với quản trị viên của cơ sở.',
  close: 'Đóng',
  /** Dòng trạng thái trên giao dịch đã gửi yêu cầu (web: khung vàng trong "Chi tiết thanh toán") */
  requested: (amount: string) => `Đã gửi yêu cầu hoàn tiền (${amount}). Lễ tân đang tiếp nhận xử lý.`,
  requestedShort: 'Đã gửi yêu cầu hoàn tiền · lễ tân đang xử lý',
  /** Tin nhắn soạn sẵn gửi lễ tân phụ trách (web: refundChatPath) */
  chatDraft: (receptionistName: string, code: string) =>
    `Chào ${receptionistName}, tôi muốn trao đổi về yêu cầu hoàn tiền mã giao dịch #${code}. Nhờ bạn hỗ trợ.`,
} as const;

/** Số ngày sử dụng còn lại tối thiểu để được hoàn theo chính sách — cùng ngưỡng với hủy gói */
export const REFUND_POLICY_DAYS = SELF_CANCEL_REFUND_THRESHOLD_DAYS;

/**
 * BE hủy gói gắn với giao dịch và thu hồi các buổi đã đặt ngay khi nhận yêu cầu hoàn tiền, nên ngoài hóa đơn / thanh toán
 * còn phải tải lại gói, lớp, lịch và thông báo (cùng danh sách như khi hội viên tự hủy gói).
 */
export const REFUND_REFRESH_KEYS = [
  'member-invoices', 'payment-record', 'invoice',
  'subscriptions', 'my-enrollments', 'my-enrollments-upcoming', 'enrollment-quota', 'course-plan', 'classes', 'member-schedule',
  'notifications', 'notifications-unread-count',
] as const;
