// components/notifications/NotificationCard.tsx
// Một thông báo (web: thẻ ở trang Thông báo): biểu tượng theo loại, tiêu đề + chấm chưa đọc, nội dung (dài thì cắt gọn kèm
// "Xem đầy đủ"), lý do, thời gian và nhãn hành động. Bấm vào thẻ = đánh dấu đã đọc + mở màn đích.
// Nút "Xem đầy đủ" nằm NGOÀI vùng bấm của thẻ (không lồng nút trong nút).

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import {
  NOTIFICATION_FALLBACK_ICON, NOTIFICATION_PREVIEW_LINES, NOTIFICATION_TEXT as TEXT, NOTIFICATION_TYPE_ICON,
} from '../../constants/notifications';
import { Colors } from '../../constants/theme';
import { timeAgo } from '../../lib/format';
import { isLongNotification } from '../../lib/notifications';
import type { AppNotification } from '../../lib/types';

interface NotificationCardProps {
  item: AppNotification;
  /** Nhãn nút hành động (null: loại này không có màn đích) */
  actionLabel: string | null;
  onOpen: (item: AppNotification) => void;
}

export function NotificationCard({ item, actionLabel, onOpen }: NotificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongNotification(item.body);
  const unread = !item.isRead;

  return (
    <View className={clsx('rounded-lg border mb-sm overflow-hidden', unread ? 'border-[#D4FF0050] bg-bg-elevated' : 'bg-bg-surface border-border')}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={item.title}
        className="flex-row gap-md p-lg"
        onPress={() => onOpen(item)}
        activeOpacity={0.7}
      >
        <View className={clsx('w-10 h-10 rounded-lg justify-center items-center', unread ? 'bg-[#D4FF0020]' : 'bg-bg-elevated')}>
          <Icon name={NOTIFICATION_TYPE_ICON[item.type] ?? NOTIFICATION_FALLBACK_ICON} size={20} color={Colors.primary} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-sm">
            <Text
              className={clsx('flex-1 text-sm text-text-primary', unread ? 'font-bevn-bold' : 'font-semibold font-bevn-semibold')}
              numberOfLines={long && !expanded ? 1 : undefined}
            >
              {item.title}
            </Text>
            {unread && <View className="w-2 h-2 rounded-full bg-primary" />}
          </View>
          <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular" numberOfLines={long && !expanded ? NOTIFICATION_PREVIEW_LINES : undefined}>
            {item.body}
          </Text>
          {Boolean(item.reason) && (
            <Text className="text-xs text-text-secondary mt-1 font-bevn-regular italic">{TEXT.reason(item.reason!)}</Text>
          )}
          <Text className="text-[10px] text-text-muted mt-1 font-bevn-regular">{timeAgo(item.createdAt)}</Text>
          {Boolean(actionLabel) && (
            <View className="self-start flex-row items-center gap-0.5 mt-sm rounded-full bg-primary pl-md pr-sm py-1">
              <Text className="text-xs font-bevn-bold text-text-inverse">{actionLabel}</Text>
              <Icon name="chevron-right" size={14} color={Colors.text.inverse} />
            </View>
          )}
        </View>
      </TouchableOpacity>
      {long && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          className="self-start px-lg pb-md"
          onPress={() => setExpanded((value) => !value)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text className="text-xs font-bevn-semibold text-primary">{expanded ? TEXT.collapse : TEXT.expand}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
