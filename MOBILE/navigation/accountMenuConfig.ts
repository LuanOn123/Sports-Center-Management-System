// navigation/accountMenuConfig.ts
// Menu tab "Tài khoản" theo vai trò — gom mọi chức năng không có tab riêng.
// Tên mục khớp menu FE web: features/user/UserLayout.tsx (hội viên), features/coach/CoachLayout.tsx (HLV).

import type { Href } from 'expo-router';
import { Colors } from '../constants/theme';
import type { Role } from '../lib/types';
import type { MaterialIconName } from './tabConfig';
import { ROUTES } from './routes';

export interface AccountMenuItem {
  icon: MaterialIconName;
  label: string;
  description?: string;
  route: Href;
  color: string;
}

export interface AccountMenuGroup {
  title: string;
  items: AccountMenuItem[];
}

const MEMBER_MENU: AccountMenuGroup[] = [
  {
    title: 'Gói và thanh toán',
    items: [
      { icon: 'workspace-premium', label: 'Gói thành viên', description: 'Gia hạn, nâng cấp, lịch sử gói', route: ROUTES.membershipPlans, color: Colors.feature.amber },
      { icon: 'receipt-long', label: 'Thanh toán & hóa đơn', route: ROUTES.payments, color: Colors.feature.amber },
    ],
  },
  {
    title: 'Hoạt động tập luyện',
    items: [
      { icon: 'insights', label: 'Điểm danh & chuyên cần', route: ROUTES.myAttendance, color: Colors.feature.cyan },
      { icon: 'login', label: 'Check-in cơ sở', route: ROUTES.checkin, color: Colors.feature.emerald },
      { icon: 'hourglass-empty', label: 'Danh sách chờ', route: ROUTES.waitlist, color: Colors.feature.violet },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      { icon: 'notifications', label: 'Thông báo', route: ROUTES.notifications, color: Colors.feature.cyan },
      { icon: 'support-agent', label: 'Yêu cầu hỗ trợ', route: ROUTES.support, color: Colors.feature.pink },
      { icon: 'auto-awesome', label: 'Trợ lý AI', route: ROUTES.aiAssistant, color: Colors.feature.violet },
    ],
  },
  {
    title: 'Tài khoản',
    items: [
      { icon: 'manage-accounts', label: 'Thông tin cá nhân & bảo mật', route: ROUTES.profile, color: Colors.feature.lime },
    ],
  },
];

const COACH_MENU: AccountMenuGroup[] = [
  {
    title: 'Giảng dạy',
    items: [
      { icon: 'class', label: 'Lớp phụ trách', route: ROUTES.classes, color: Colors.feature.lime },
      { icon: 'event-busy', label: 'Xin nghỉ phép', route: ROUTES.coachLeave, color: Colors.feature.amber },
      { icon: 'star', label: 'Đánh giá của hội viên', route: ROUTES.coachFeedback, color: Colors.feature.pink },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      { icon: 'notifications', label: 'Thông báo', route: ROUTES.notifications, color: Colors.feature.cyan },
      { icon: 'auto-awesome', label: 'Trợ lý AI', route: ROUTES.aiAssistant, color: Colors.feature.violet },
    ],
  },
  {
    title: 'Tài khoản',
    items: [
      { icon: 'manage-accounts', label: 'Thông tin cá nhân & bảo mật', route: ROUTES.profile, color: Colors.feature.lime },
    ],
  },
];

export function getAccountMenuForRole(role: Role | undefined): AccountMenuGroup[] {
  return role === 'COACH' ? COACH_MENU : MEMBER_MENU;
}
