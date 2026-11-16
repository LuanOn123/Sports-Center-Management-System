// navigation/tabConfig.ts
// Cấu hình thanh điều hướng Bottom Tab Bar theo vai trò (5 tab hiện):
// - Hội viên: Trang chủ · Khám phá · Lịch · Tin nhắn · Tài khoản
// - HLV:      Trang chủ · Lịch dạy · Điểm danh · Tin nhắn · Tài khoản
// Mỗi file trong app/(tabs) phải được khai báo ở đây; tab chỉ dành cho một vai trò vẫn có mặt (visible: false) nhưng bị chặn ở canAccessRoute.
// Màn con KHÔNG phải tab: Thông tin cá nhân nằm trong Stack của tab Tài khoản (app/(tabs)/account/), còn Thông báo và Lớp phụ trách của
// HLV là màn đẩy lên trên tabs — nhờ vậy cả ba vuốt từ trái sang phải để quay lại được. Thứ tự mảng = thứ tự trên thanh tab.

import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import type { Role } from '../lib/types';

export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export interface TabItemConfig {
  name: string;
  title: string;
  iconName: MaterialIconName;
  visible: boolean;
  isChat?: boolean;
  /** Tab chứa Stack bên trong: rời tab thì về màn đầu của Stack (tab Tài khoản luôn mở ra menu, không phải màn con đang mở dở) */
  popToTopOnBlur?: boolean;
}

// Icon các tab = icon web dùng cho cùng mục (UserLayout/PortalLayout: LayoutDashboard, Search, CalendarDays, MessageCircle; ProfileMenu: UserRound)
const HOME: TabItemConfig = { name: 'index', title: 'Trang chủ', iconName: 'dashboard', visible: true };
const CHAT: TabItemConfig = { name: 'chat', title: 'Tin nhắn', iconName: 'chat', visible: true, isChat: true };
const ACCOUNT: TabItemConfig = { name: 'account', title: 'Tài khoản', iconName: 'person-outline', visible: true, popToTopOnBlur: true };

export function getTabConfigForRole(role: Role | undefined): TabItemConfig[] {
  if (role === 'COACH') {
    return [
      HOME,
      { name: 'schedule', title: 'Lịch dạy', iconName: 'today', visible: true },
      // Chỉ HLV vào được — chặn ở navigation/routes.ts (canAccessRoute)
      // Web: nút "Điểm danh" (shared/QuickActions) dùng ScanLine
      { name: 'coach-attendance', title: 'Điểm danh', iconName: 'qr-code-scanner', visible: true },
      CHAT,
      ACCOUNT,
      // Tab Khám phá của hội viên — HLV không vào được (canAccessRoute); lớp phụ trách của HLV ở coach/classes
      { name: 'classes', title: 'Khám phá', iconName: 'explore', visible: false },
      { name: 'enrollments', title: 'Lớp của tôi', iconName: 'event-note', visible: false },
    ];
  }
  return [
    HOME,
    { name: 'classes', title: 'Khám phá', iconName: 'explore', visible: true },
    { name: 'schedule', title: 'Lịch tập', iconName: 'today', visible: true },
    CHAT,
    ACCOUNT,
    { name: 'enrollments', title: 'Lớp của tôi', iconName: 'event-note', visible: false },
    { name: 'coach-attendance', title: 'Điểm danh', iconName: 'check-circle', visible: false },
  ];
}
