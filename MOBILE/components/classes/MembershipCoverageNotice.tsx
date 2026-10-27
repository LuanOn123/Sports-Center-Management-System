// components/classes/MembershipCoverageNotice.tsx
// Banner "đủ điều kiện thời hạn cho trọn kỳ" (web: AlertBanner info trong ClassDetailPage): hiện khi BE xác nhận gói
// hết hạn trước buổi cuối của khóa nhưng còn ≥ 50% thời hạn lúc đăng ký → quyền học áp dụng đến hết kỳ.

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { Card } from '../ui';
import { TERM_NOTICE_COLOR } from '../../constants/terms';

interface MembershipCoverageNoticeProps {
  title: string;
  message: string;
}

export function MembershipCoverageNotice({ title, message }: MembershipCoverageNoticeProps) {
  const color = TERM_NOTICE_COLOR.info;
  return (
    <Card accent={color} className="gap-xs" accessibilityLabel={title}>
      <View className="flex-row items-center gap-sm">
        <Icon name="check-circle" size={18} color={color} />
        <Text className="flex-1 text-md text-text-primary font-bevn-bold">{title}</Text>
      </View>
      <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">{message}</Text>
    </Card>
  );
}
