// navigation/quickAccessConfig.ts
// 4 lối tắt trên Trang chủ theo vai trò — KHÔNG trùng với tab (Khám phá, Lịch, Tin nhắn, Tài khoản)
// hay chuông thông báo; phần còn lại nằm trong menu Tài khoản (navigation/accountMenuConfig.ts).
// Tương ứng "Thao tác nhanh" trên Trang chủ web.

import type { Href } from 'expo-router';
import { Colors } from '../constants/theme';
import type { Role } from '../lib/types';
import type { MaterialIconName } from './tabConfig';
import { ROUTES } from './routes';

export interface QuickAccessItem {
  icon: MaterialIconName;
  label: string;
  route: Href;
  color: string;
}

const MEMBER_ITEMS: QuickAccessItem[] = [
  { icon: 'login', label: 'Check-in', route: ROUTES.checkin, color: Colors.feature.emerald },
  { icon: 'workspace-premium', label: 'Gói tập', route: ROUTES.membershipPlans, color: Colors.feature.amber },
  { icon: 'insights', label: 'Chuyên cần', route: ROUTES.myAttendance, color: Colors.feature.cyan },
  { icon: 'auto-awesome', label: 'Trợ lý AI', route: ROUTES.aiAssistant, color: Colors.feature.violet },
];

const COACH_ITEMS: QuickAccessItem[] = [
  { icon: 'class', label: 'Lớp phụ trách', route: ROUTES.classes, color: Colors.feature.lime },
  { icon: 'event-busy', label: 'Xin nghỉ', route: ROUTES.coachLeave, color: Colors.feature.amber },
  { icon: 'star', label: 'Đánh giá', route: ROUTES.coachFeedback, color: Colors.feature.pink },
  { icon: 'auto-awesome', label: 'Trợ lý AI', route: ROUTES.aiAssistant, color: Colors.feature.violet },
];

export function getQuickAccessForRole(role: Role | undefined): QuickAccessItem[] {
  return role === 'COACH' ? COACH_ITEMS : MEMBER_ITEMS;
}
