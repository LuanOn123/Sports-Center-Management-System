// constants/workflow.ts
// Chữ hiển thị và tham số của các màn nghiệp vụ nhỏ dựng bằng WorkflowScreen: check-in, danh sách chờ, yêu cầu hỗ trợ,
// hóa đơn / thanh toán và đánh giá của huấn luyện viên. Nội dung bám web (FacilityVisits, Waitlist, OperationsPage…).

export const MEMBER_PROFILE_MISSING = 'Chưa có hồ sơ hội viên.';

/** Nhãn trạng thái chung của các bản ghi nghiệp vụ (danh sách chờ, hỗ trợ, hóa đơn, thanh toán, yêu cầu) */
export const WORKFLOW_STATUS_LABEL: Record<string, string> = {
  WAITING: 'Đang chờ',
  PROMOTED: 'Đã được xếp chỗ',
  CANCELLED: 'Đã hủy',
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  OPEN: 'Mới tiếp nhận',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
  ISSUED: 'Đã phát hành',
};

/** Check-in cơ sở (web: FacilityVisits) */
export const CHECKIN_TEXT = {
  title: 'Check-in cơ sở',
  cardTitle: 'Ghi nhận vào cửa',
  intro: 'Cần gói còn hiệu lực; gói FREE cũng được vào cửa. Check-in lặp trong 5 phút sẽ trả lại lượt vừa ghi nhận.',
  action: 'Check-in vào cơ sở',
  recorded: (time: string) => `Đã ghi nhận lúc ${time}.`,
  historyTitle: 'Lịch sử vào cửa trên mọi cơ sở',
  empty: 'Chưa có lượt vào cửa.',
  facilityFallback: 'Cơ sở',
  byReception: 'Tại quầy',
  selfService: 'Tự check-in',
} as const;

/** Giá trị `method` của lượt vào cửa do lễ tân ghi nhận */
export const VISIT_METHOD_RECEPTION = 'RECEPTION';

/** Danh sách chờ theo buổi (web: Waitlist) */
export const WAITLIST_TEXT = {
  title: 'Danh sách chờ',
  intro: 'Khi có chỗ trống, hệ thống xét theo thứ tự chờ và kiểm tra lại gói tập, quota, lịch học và quyết định chuyên cần. Vào danh sách chờ chưa đảm bảo có chỗ.',
  empty: 'Chưa có lượt đăng ký chờ.',
  sessionFallback: 'Buổi học',
  position: (position: number, status: string) => `Thứ tự ${position} · ${status}`,
  leave: 'Rời danh sách chờ',
  leaveConfirmBody: 'Bạn sẽ mất vị trí chờ của buổi này.',
  leaveConfirmAction: 'Rời danh sách',
} as const;

/** Nút vào danh sách chờ của một buổi hết chỗ (web: WaitlistAction) */
export const WAITLIST_ACTION_TEXT = {
  join: 'Vào danh sách chờ',
  waiting: (position: number) => `Đang chờ · thứ tự ${position}`,
  joined: (position: number) => `Đã vào danh sách chờ · thứ tự ${position}.`,
  view: 'Xem danh sách chờ',
} as const;

/** Danh sách chờ tự làm mới mỗi chừng này để thấy lúc được xếp chỗ (web: refetchInterval) */
export const WAITLIST_REFRESH_MS = 30_000;

/** Khi một lượt chờ được xếp chỗ, các dữ liệu này đổi theo nên phải tải lại (web: Waitlist) */
export const WAITLIST_PROMOTED_REFRESH_KEYS = [
  'my-enrollments', 'my-enrollments-upcoming', 'enrollment-quota', 'member-schedule', 'class-schedules', 'course-plan',
] as const;

/** Yêu cầu hỗ trợ (web: OperationsPage kind="issues") */
export const SUPPORT_TEXT = {
  title: 'Yêu cầu hỗ trợ',
  formTitle: 'Gửi yêu cầu',
  subjectLabel: 'Tiêu đề',
  bodyLabel: 'Nội dung',
  submit: 'Gửi yêu cầu',
  sent: 'Đã gửi yêu cầu đến trung tâm.',
  empty: 'Chưa có yêu cầu hỗ trợ.',
  response: (text: string) => `Phản hồi: ${text}`,
  remove: 'Xóa yêu cầu',
  removeConfirmTitle: 'Xóa yêu cầu',
  removeConfirmBody: 'Xóa yêu cầu hỗ trợ chưa được xử lý?',
  removeConfirmAction: 'Xóa',
  /** Thay cho nội dung thô của báo cáo chuyên cần do hệ thống tự gửi quản lý */
  attendanceReport: 'Báo cáo chuyên cần đã được gửi đến quản lý. Xem chi tiết tỷ lệ và quyết định tại mục Chuyên cần.',
} as const;

/** Giới hạn độ dài của yêu cầu hỗ trợ (khớp BE) */
export const SUPPORT_LIMITS = { subjectMin: 3, subjectMax: 120, bodyMin: 5, bodyMax: 3000 } as const;

/** Báo cáo chuyên cần tự động nằm trong mô tả yêu cầu dưới dạng JSON có nhãn này */
export const ATTENDANCE_REPORT_MARKER = '"ATTENDANCE_VIOLATION"';

/** Thanh toán & hóa đơn của hội viên (web: MemberPaymentsPage) */
export const PAYMENTS_TEXT = {
  title: 'Thanh toán & hóa đơn',
  intro: 'Các khoản thu của bạn được ghi nhận tại trung tâm. Liên hệ trung tâm nếu cần đối chiếu hoặc hoàn tiền.',
  empty: 'Chưa có hóa đơn.',
  viewInvoice: 'Xem / Lưu hóa đơn',
  paymentDetail: 'Chi tiết thanh toán',
} as const;

export const INVOICE_TEXT = {
  title: 'Hóa đơn thanh toán',
  brand: 'PULSE SPORTS CENTER',
  member: (name: string) => `Hội viên: ${name}`,
  memberFallback: 'Chưa lưu tên tại thời điểm phát hành',
  plan: (name: string) => `Gói tập: ${name}`,
  issuedAt: (date: string) => `Ngày phát hành: ${date}`,
  amounts: (subtotal: string, discount: string) => `Tạm tính: ${subtotal} · Giảm giá: ${discount}`,
  total: (amount: string) => `Tổng thanh toán: ${amount}`,
  print: 'In / Lưu PDF',
  emptyValue: '—',
} as const;

export const PAYMENT_DETAIL_TEXT = {
  title: 'Chi tiết thanh toán',
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản ngân hàng',
  transactionCode: (code: string) => `Mã giao dịch: ${code}`,
  createdAt: (date: string) => `Ngày tạo: ${date}`,
  paidAt: (date: string) => `Đã thanh toán: ${date}`,
  emptyValue: '—',
} as const;

/** Giá trị `method` của khoản thu bằng tiền mặt */
export const PAYMENT_METHOD_CASH = 'CASH';

/** Đánh giá của hội viên dành cho huấn luyện viên (web: CoachFeedback, vai trò COACH) */
export const COACH_FEEDBACK_TEXT = {
  title: 'Đánh giá của hội viên',
  noProfile: 'Chưa có hồ sơ huấn luyện viên. Vui lòng liên hệ quản lý.',
  average: (value: number | string | null | undefined) => `${value ?? '—'} / 5`,
  total: (count: number) => `${count} đánh giá`,
  empty: 'Chưa có đánh giá.',
  anonymous: 'Ẩn danh',
  memberFallback: 'Hội viên',
  noComment: 'Không có nhận xét.',
  page: (page: number, total: number) => `Trang ${page} / ${total}`,
  previous: 'Trang trước',
  next: 'Trang sau',
} as const;
