// navigation/tabConfig.ts
// Cấu hình thanh điều hướng Bottom Tab Bar theo vai trò (Coach vs Member)

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
    {
      name: 'index',
      title: 'Trang chủ',
      iconName: 'home',
      visible: true,
    },
    {
      name: 'classes',
      title: isCoach ? 'Lớp dạy' : 'Lớp học',
      iconName: 'fitness-center',
      visible: true,
    },
    {
      name: 'schedule',
      title: 'Lịch tập',
      iconName: 'event',
      visible: !isCoach, // Chỉ hiện cho Member
    },
    {
      name: 'training',
      title: 'Điểm danh',
      iconName: 'how-to-reg',
      visible: isCoach, // Bỏ tab "Tập luyện" của Member — chỉ Coach còn dùng để điểm danh
    },
    {
      name: 'chat',
      title: 'Nhắn tin',
      iconName: 'chat',
      visible: true,
      isChat: true,
    },
    {
      name: 'notifications',
      title: 'Thông báo',
      iconName: 'notifications',
      visible: true,
      isNotifications: true,
    },
  ];
}
