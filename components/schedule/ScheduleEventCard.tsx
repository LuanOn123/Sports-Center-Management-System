// components/schedule/ScheduleEventCard.tsx
// Thẻ một buổi học trên lịch — dùng chung cho Hội viên (Lịch) và HLV (Lịch dạy) để hai màn trông như một:
// giờ, trạng thái, tên lớp, phòng, lời gợi ý, và (tuỳ chọn) nút phụ như "Hủy".

import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { StatusBadge } from '../ui';
import { Colors } from '../../constants/theme';
import { formatTime } from '../../lib/format';

interface ScheduleEventCardProps {
  startTime: string;
  endTime: string;
  title: string;
  room?: string | null;
  badge?: { label: string; color: string };
  /** Lời gợi ý góc phải dưới, vd. "Xem học viên →" */
  hint?: string;
  /** Làm mờ (buổi đã hủy) */
  muted?: boolean;
  /** Buổi đã diễn ra: chỉ giữ màu của nhãn trạng thái, phần còn lại của thẻ (giờ, tên, gợi ý) chuyển xám */
  done?: boolean;
  /** Màu viền nổi bật, vd. buổi hôm nay sắp diễn ra (vàng cam) */
  highlight?: string;
  /** Nút phụ nằm ngoài vùng bấm của thẻ, vd. "Hủy" */
  trailing?: ReactNode;
  onPress: () => void;
}

export function ScheduleEventCard({ startTime, endTime, title, room, badge, hint, muted, done, highlight, trailing, onPress }: ScheduleEventCardProps) {
  const accent = done ? Colors.text.muted : Colors.primary;
  return (
    <View
      className="flex-row items-stretch bg-bg-surface rounded-lg border border-border mb-sm overflow-hidden"
      style={{ opacity: muted ? 0.6 : 1, ...(highlight ? { borderColor: highlight } : null) }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatTime(startTime)} đến ${formatTime(endTime)}`}
        className="flex-1 p-md"
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View className="flex-row justify-between items-center mb-xs">
          <View className="flex-row items-center gap-1">
            <Icon name="access-time" size={14} color={accent} />
            <Text className="text-sm font-bevn-semibold" style={{ color: accent }}>{formatTime(startTime)} – {formatTime(endTime)}</Text>
          </View>
          {badge && <StatusBadge label={badge.label} color={badge.color} />}
        </View>
        <Text className={`text-md font-bevn-bold ${done ? 'text-text-secondary' : 'text-text-primary'}`} numberOfLines={2}>{title}</Text>
        <View className="flex-row justify-between items-center mt-xs">
          <View className="flex-row items-center gap-1 flex-1 mr-sm">
            <Icon name="place" size={13} color={Colors.text.secondary} />
            <Text className="text-xs text-text-secondary font-bevn-regular" numberOfLines={1}>{room || '—'}</Text>
          </View>
          {Boolean(hint) && <Text className="text-xs font-bevn-medium" style={{ color: accent }}>{hint}</Text>}
        </View>
      </TouchableOpacity>
      {trailing && <View className="justify-center pr-md">{trailing}</View>}
    </View>
  );
}
