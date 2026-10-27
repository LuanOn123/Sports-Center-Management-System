// navigation/tabConfig.ts
// Cấu hình thanh điều hướng Bottom Tab Bar theo vai trò (5 tab hiện):
// - Hội viên: Trang chủ · Khám phá · Lịch · Tin nhắn · Tài khoản
// - HLV:      Trang chủ · Lịch dạy · Điểm danh · Tin nhắn · Tài khoản
// Các route khác vẫn nằm trong Tabs (để giữ thanh tab) nhưng ẩn khỏi thanh (visible: false):
// vào từ Trang chủ / Tài khoản / chuông thông báo. Thứ tự mảng = thứ tự trên thanh tab.

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
}

const HOME: TabItemConfig = { name: 'index', title: 'Trang chủ', iconName: 'home', visible: true };
const CHAT: TabItemConfig = { name: 'chat', title: 'Tin nhắn', iconName: 'chat', visible: true, isChat: true };
const ACCOUNT: TabItemConfig = { name: 'account', title: 'Tài khoản', iconName: 'person', visible: true };
// Màn con (ẩn khỏi thanh tab)
const PROFILE: TabItemConfig = { name: 'profile', title: 'Thông tin cá nhân', iconName: 'person', visible: false };
const NOTIFICATIONS: TabItemConfig = { name: 'notifications', title: 'Thông báo', iconName: 'notifications', visible: false };

export function getTabConfigForRole(role: Role | undefined): TabItemConfig[] {
  if (role === 'COACH') {
    return [
      HOME,
      { name: 'schedule', title: 'Lịch dạy', iconName: 'today', visible: true },
      // Chỉ HLV vào được — chặn ở navigation/routes.ts (canAccessRoute)
      { name: 'coach-attendance', title: 'Điểm danh', iconName: 'check-circle', visible: true },
      CHAT,
      ACCOUNT,
      { name: 'classes', title: 'Lớp phụ trách', iconName: 'fitness-center', visible: false },
      { name: 'enrollments', title: 'Lớp của tôi', iconName: 'event-note', visible: false },
      PROFILE,
      NOTIFICATIONS,
    ];
  }
  return [
    HOME,
    { name: 'classes', title: 'Khám phá', iconName: 'explore', visible: true },
    { name: 'schedule', title: 'Lịch học', iconName: 'today', visible: true },
    CHAT,
    ACCOUNT,
    { name: 'enrollments', title: 'Lớp của tôi', iconName: 'event-note', visible: false },
    { name: 'coach-attendance', title: 'Điểm danh', iconName: 'check-circle', visible: false },
    PROFILE,
    NOTIFICATIONS,
  ];
}
