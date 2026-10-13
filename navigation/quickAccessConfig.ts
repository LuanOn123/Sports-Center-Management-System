// navigation/quickAccessConfig.ts
// Cấu hình lưới "Truy cập nhanh" trên Trang chủ theo vai trò

import type { Href } from 'expo-router';
import { Colors } from '../constants/theme';
import type { Role } from '../lib/types';
import type { MaterialIconName } from './tabConfig';
import { ROUTES } from './routes';

export interface QuickAccessItem {
  icon: MaterialIconName;
  label: string;
  desc: string;
  route: Href;
  color: string;
}

// Icon khớp menu FE web (lucide): Search, BookOpen, CalendarDays, CreditCard, CircleCheck, UserRound
// — xem FE/src/features/user/UserLayout.tsx và FE/src/features/coach/CoachLayout.tsx.
// Tên bên dưới là key của components/shared/Icon.tsx (map sang lucide tương ứng).
const MEMBER_ITEMS: QuickAccessItem[] = [
  { icon: 'search', label: 'Khám phá', desc: 'Tìm & đăng ký lớp', route: ROUTES.classes, color: Colors.feature.lime },
  { icon: 'class', label: 'Lớp học', desc: 'Lớp đã đặt, đổi buổi', route: ROUTES.enrollments, color: Colors.feature.violet },
  { icon: 'today', label: 'Lịch tập', desc: 'Thời khóa biểu cá nhân', route: ROUTES.schedule, color: Colors.feature.cyan },
  { icon: 'payment', label: 'Gói tập', desc: 'Hội viên & quyền lợi', route: ROUTES.membershipPlans, color: Colors.feature.amber },
  { icon: 'check-circle', label: 'Chuyên cần', desc: 'Lịch sử điểm danh', route: ROUTES.myAttendance, color: Colors.feature.emerald },
  { icon: 'person-outline', label: 'Hồ sơ', desc: 'Thông tin tài khoản', route: ROUTES.profile, color: Colors.feature.pink },
  { icon: 'payment', label: 'Hóa đơn', desc: 'Thanh toán & hóa đơn', route: ROUTES.payments, color: Colors.feature.amber },
  { icon: 'check-circle', label: 'Check-in', desc: 'Vào cửa cơ sở', route: ROUTES.checkin, color: Colors.feature.emerald },
  { icon: 'class', label: 'Danh sách chờ', desc: 'Theo dõi chỗ trống', route: ROUTES.waitlist, color: Colors.feature.violet },
  { icon: 'chat', label: 'Hỗ trợ', desc: 'Gửi yêu cầu đến trung tâm', route: ROUTES.support, color: Colors.feature.cyan },
  { icon: 'notifications', label: 'Thông báo', desc: 'Cập nhật từ trung tâm', route: ROUTES.notifications, color: Colors.feature.amber },
  { icon: 'chat', label: 'Trợ lý AI', desc: 'Hỏi về lịch và tập luyện', route: ROUTES.aiAssistant, color: Colors.feature.pink },
];

const COACH_ITEMS: QuickAccessItem[] = [
  { icon: 'class', label: 'Lớp dạy', desc: 'Danh sách lớp phụ trách', route: ROUTES.classes, color: Colors.feature.lime },
  { icon: 'check-circle', label: 'Điểm danh', desc: 'Điểm danh học viên', route: ROUTES.coachAttendance, color: Colors.feature.emerald },
  { icon: 'today', label: 'Lịch dạy', desc: 'Thời khóa biểu tuần', route: ROUTES.schedule, color: Colors.feature.cyan },
  { icon: 'person-outline', label: 'Hồ sơ', desc: 'Thông tin cá nhân', route: ROUTES.profile, color: Colors.feature.violet },
  { icon: 'today', label: 'Nghỉ phép', desc: 'Gửi đơn & xem xét duyệt', route: ROUTES.coachLeave, color: Colors.feature.amber },
  { icon: 'star', label: 'Đánh giá', desc: 'Nhận xét của hội viên', route: ROUTES.coachFeedback, color: Colors.feature.pink },
  { icon: 'notifications', label: 'Thông báo', desc: 'Cập nhật từ trung tâm', route: ROUTES.notifications, color: Colors.feature.cyan },
  { icon: 'chat', label: 'Trợ lý AI', desc: 'Hỏi về hoạt động trung tâm', route: ROUTES.aiAssistant, color: Colors.feature.violet },
];

export function getQuickAccessForRole(role: Role | undefined): QuickAccessItem[] {
  return role === 'COACH' ? COACH_ITEMS : MEMBER_ITEMS;
}
