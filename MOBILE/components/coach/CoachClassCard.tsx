// components/coach/CoachClassCard.tsx
// Thẻ lớp trên màn "Lớp phụ trách" của HLV (web: CoachWorkspace mode "classes" › coach-class-card): môn, hạng lớp, tên, mô tả,
// sức chứa mỗi buổi, trạng thái hoạt động và hai lối — chi tiết lớp / xem lịch dạy của lớp.
// Khác thẻ của hội viên: không có chỗ trống hay kỳ đăng ký (đó là dữ liệu để hội viên chọn lớp, không tải cho HLV).

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { Button } from '../ui/Button';
import { CLASS_TYPE_COLOR, CLASS_TYPE_LABEL, COACH_CLASS_TEXT as TEXT } from '../../constants/classes';
import { Colors } from '../../constants/theme';
import type { Class } from '../../lib/types';

interface CoachClassCardProps {
  item: Class;
  onOpenDetail: () => void;
  onOpenSchedule: () => void;
}

export function CoachClassCard({ item, onOpenDetail, onOpenSchedule }: CoachClassCardProps) {
  const typeColor = CLASS_TYPE_COLOR[item.classType];
  const statusColor = item.isActive === false ? Colors.status.cancelled : Colors.status.success;

  return (
    <View className="bg-bg-surface rounded-xl p-lg border border-border">
      <View className="flex-row items-center justify-between mb-xs">
        <Text className="flex-1 text-xs text-primary font-bevn-semibold mr-sm" numberOfLines={1}>
          {item.sports?.map((sport) => sport.name).join(' · ') || 'Lớp học'}
        </Text>
        <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: typeColor + '20' }}>
          <Text className="text-xs font-bevn-semibold" style={{ color: typeColor }}>{CLASS_TYPE_LABEL[item.classType]}</Text>
        </View>
      </View>

      <Text className="text-lg font-bevn-bold text-text-primary">{item.name}</Text>
      <Text className="text-sm text-text-muted font-bevn-regular mt-xs" numberOfLines={2}>{item.description || TEXT.defaultDescription}</Text>

      <View className="flex-row items-center justify-between gap-md mt-md pt-md border-t border-border">
        <View className="flex-row items-center gap-1 flex-1">
          <Icon name="people" size={14} color={Colors.text.muted} />
          <Text className="text-sm text-text-secondary font-bevn-regular" numberOfLines={1}>{TEXT.capacity(item.capacity)}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <Text className="text-sm font-bevn-medium" style={{ color: statusColor }}>{item.isActive === false ? TEXT.inactive : TEXT.active}</Text>
        </View>
      </View>

      <View className="flex-row gap-md mt-md">
        <Button className="flex-1" size="sm" variant="secondary" title={TEXT.detail} onPress={onOpenDetail} />
        <Button className="flex-1" size="sm" icon="today" title={TEXT.schedule} onPress={onOpenSchedule} />
      </View>
    </View>
  );
}
