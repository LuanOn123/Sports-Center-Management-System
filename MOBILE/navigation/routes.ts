// navigation/routes.ts
// Nguồn duy nhất cho đường dẫn màn hình + quyền truy cập theo vai trò.
// Mọi router.push/replace phải dùng ROUTES, không viết tay chuỗi đường dẫn.

import type { Href } from 'expo-router';
import type { Role } from '../lib/types';

export const ROUTES = {
  // Chưa đăng nhập
  login: '/auth/login',
  register: '/auth/register',
  /** Hoàn tất đăng ký bằng Google (bổ sung số điện thoại, giới tính, ngày sinh, mục tiêu) */
  googleRegister: '/auth/google-register',
  forgotPassword: '/auth/forgot-password',

  // Tabs
  home: '/(tabs)',
  chat: '/(tabs)/chat',
  account: '/(tabs)/account',
  /** Thông tin cá nhân: màn con trong Stack của tab Tài khoản — vẫn có thanh tab (tab Tài khoản sáng) và vuốt quay lại được */
  profile: '/(tabs)/account/profile',
  /** Khám phá (hội viên); HLV xem lớp phụ trách ở coachClasses */
  classes: '/(tabs)/classes',
  schedule: '/(tabs)/schedule',
  enrollments: '/(tabs)/enrollments',
  /** Tab Lịch, mở sẵn phần "Lớp của tôi" */
  myClasses: { pathname: '/(tabs)/schedule', params: { view: 'classes' } } as Href,
  /** Tab Điểm danh của HLV: danh sách buổi để chọn (danh sách học viên của một buổi là coachAttendanceFor) */
  coachAttendance: '/(tabs)/coach-attendance',

  // Màn ngoài tabs
  /** Thông báo: đẩy lên trên các tab (không thanh tab) để vuốt từ trái sang phải quay về đúng màn vừa bấm chuông */
  notifications: '/notifications',
  membershipPlans: '/membership/plans',
  myAttendance: '/attendance/my',
  checkin: '/member/checkin',
  waitlist: '/member/waitlist',
  support: '/member/support',
  /** Chính sách sử dụng (web: Policies) — cả Hội viên và Huấn luyện viên */
  policies: '/policies',
  /** Hướng dẫn sử dụng (web: HelpPanel) — cả Hội viên và Huấn luyện viên */
  help: '/help',
  payments: '/member/payments',
  /** Lớp phụ trách của HLV (hội viên dùng tab Khám phá = classes) — nằm trong khu vực coach nên vuốt quay lại được */
  coachClasses: '/coach/classes',
  coachChanges: '/coach/coach-changes',
  coachFeedback: '/coach/feedback',
  /** Hồ sơ học viên; kèm buổi dạy để lấy liên hệ, lưu ý sức khỏe và tiến độ từ danh sách học viên của buổi đó */
  coachMember: (id: string, scheduleId?: string): Href => ({ pathname: '/coach/member/[id]', params: { id, ...(scheduleId ? { scheduleId } : {}) } }),
  aiAssistant: '/assistant',

  // Route động
  classDetail: (id: string): Href => ({ pathname: '/classes/[id]', params: { id } }),
  scheduleDetail: (scheduleId: string): Href => ({ pathname: '/schedule/[scheduleId]', params: { scheduleId } }),
  payment: (paymentId: string): Href => ({ pathname: '/payment/[paymentId]', params: { paymentId } }),
  invoice: (id: string): Href => ({ pathname: '/invoice/[id]', params: { id } }),
  paymentDetail: (id: string): Href => ({ pathname: '/member/payment-detail/[id]', params: { id } }),
  /** Cuộc trò chuyện với một người; `message` = tin soạn sẵn trong ô soạn (web: ?userId=…&message=…, vd. nhắn lễ tân về hoàn tiền) */
  chatThread: (userId: string, name?: string, message?: string): Href => ({
    pathname: '/chat/[userId]',
    params: { userId, ...(name ? { name } : {}), ...(message ? { message } : {}) },
  }),
  /**
   * Điểm danh MỘT buổi (danh sách học viên): màn con của khu vực coach, đẩy lên trên tabs. KHÔNG trỏ vào tab Điểm danh: chuyển giữa các tab không
   * phải là "đẩy" màn hình nên không có trang trước để vuốt từ trái sang phải quay lại (Lịch dạy → Điểm danh, Trang chủ → Điểm danh…).
   */
  coachAttendanceFor: (scheduleId: string): Href => ({ pathname: '/coach/attendance/[scheduleId]', params: { scheduleId } }),
  /** Tab Lịch dạy của HLV, mở sẵn bộ lọc một lớp (web: nút "Xem lịch dạy" ở thẻ lớp phụ trách) */
  coachScheduleFor: (classId: string): Href => ({ pathname: '/(tabs)/schedule', params: { classId } }),
} as const;

/**
 * Vai trò được vào từng nhóm route ngoài tabs (theo segment đầu tiên).
 * Route không có trong bảng = mọi vai trò đã đăng nhập đều vào được.
 */
const ROUTE_ROLES: Record<string, readonly Role[]> = {
  membership: ['MEMBER'],
  payment: ['MEMBER'],
  attendance: ['MEMBER'],
  member: ['MEMBER'],
  invoice: ['MEMBER'],
  coach: ['COACH'],
};

/**
 * Vai trò được vào từng tab trong "(tabs)" (theo segment ngay sau "(tabs)"). Bảng riêng vì tên tab có thể trùng nhóm route ngoài tabs:
 * tab "classes" (Khám phá) chỉ của hội viên, còn "classes/[id]" (chi tiết lớp) dùng chung cho cả hai vai trò.
 */
const TAB_ROLES: Record<string, readonly Role[]> = {
  classes: ['MEMBER'],
  enrollments: ['MEMBER'],
  'coach-attendance': ['COACH'],
};

export function canAccessRoute(role: Role | undefined, segments: readonly string[]) {
  const inTabs = segments[0] === '(tabs)';
  const name = inTabs ? segments[1] : segments[0];
  const allowed = name ? (inTabs ? TAB_ROLES : ROUTE_ROLES)[name] : undefined;
  return !allowed || (role !== undefined && allowed.includes(role));
}
