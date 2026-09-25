// navigation/tabConfig.ts
// Cấu hình thanh điều hướng Bottom Tab Bar
// Chỉ hiển thị 3 tab chính: Trang chủ, Tin nhắn, Hồ sơ.
// Các màn hình khác được đăng ký vào Tabs layout nhưng ẩn khỏi thanh điều hướng (visible: false / href: null).

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
  isNotifications?: boolean;
}

export function getTabConfigForRole(role: Role | undefined): TabItemConfig[] {
  const isCoach = role === 'COACH';

  return [
    // ─── 3 TAB CHÍNH HIỂN THỊ DƯỚI BOTTOM BAR ──────────────────────
    {
      name: 'index',
      title: 'Trang chủ',
      iconName: 'home',
      visible: true,
    },
    {
      name: 'chat',
      title: 'Tin nhắn',
      iconName: 'chat',
      visible: true,
      isChat: true,
    },
    {
      name: 'profile',
      title: 'Hồ sơ',
      iconName: 'person',
      visible: true,
    },

    // ─── CÁC ROUTE PHỤ TRONG TABS (ẨN KHỎI BOTTOM BAR) ───────────
    {
      name: 'classes',
      title: isCoach ? 'Lớp dạy' : 'Khám phá',
      iconName: isCoach ? 'fitness-center' : 'explore',
      visible: false,
    },
    {
      name: 'enrollments',
      title: 'Lớp học',
      iconName: 'event-note',
      visible: false,
    },
    {
      name: 'schedule',
      title: 'Lịch tập',
      iconName: 'event',
      visible: false,
    },
    {
      name: 'training',
      title: 'Điểm danh',
      iconName: 'how-to-reg',
      visible: false,
    },
    {
      name: 'notifications',
      title: 'Thông báo',
      iconName: 'notifications',
      visible: false,
      isNotifications: true,
    },
  ];
}
