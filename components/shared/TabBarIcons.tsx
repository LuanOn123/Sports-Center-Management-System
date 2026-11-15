// components/shared/TabBarIcons.tsx
// Biểu tượng trên thanh tab dưới đáy: icon thường, và icon Tin nhắn kèm huy hiệu số tin chưa đọc.

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from './Icon';
import { useChatUnreadCount } from '../../hooks/shared/useChatUnreadCount';
import { TAB_BADGE_MAX, TAB_BAR } from '../../constants/tabBar';
import type { MaterialIconName } from '../../navigation';

export function TabIcon({ name, color }: { name: MaterialIconName; color: string | any }) {
  return <Icon name={name} size={TAB_BAR.iconSize} color={String(color)} />;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View className="absolute -top-1 -right-2 bg-status-expired rounded-full min-w-[16px] h-4 justify-center items-center px-[3px] border-[1.5px] border-bg-surface">
      <Text className="text-[9px] font-bevn-bold text-white leading-[13px]">{count > TAB_BADGE_MAX ? `${TAB_BADGE_MAX}+` : String(count)}</Text>
    </View>
  );
}

export function ChatTabIcon({ color }: { color: string | any }) {
  const unread = useChatUnreadCount();
  return (
    <View className="relative">
      <Icon name="chat" size={TAB_BAR.iconSize} color={String(color)} />
      <Badge count={unread} />
    </View>
  );
}
