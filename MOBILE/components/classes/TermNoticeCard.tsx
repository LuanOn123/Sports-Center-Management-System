// components/classes/TermNoticeCard.tsx
// Thẻ thông báo kỳ học cho hội viên (web: MemberTermBanner): tên kỳ + giai đoạn đăng ký + nhãn "Đăng ký muộn"
// khi đã quá hạn nhưng gói còn ≥ 50% thời hạn, kèm nút mở Gói tập khi chưa đủ điều kiện.

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { Button, Card, StatusBadge } from '../ui';
import { LATE_REGISTRATION_TEXT, TERM_NOTICE_COLOR, TERM_NOTICE_ICON } from '../../constants/terms';
import type { TermNotice } from '../../lib/termRegistration';

interface TermNoticeCardProps {
  termName: string;
  notice: TermNotice;
  /** Mở màn Gói tập — chỉ hiện nút khi `notice.suggestPlans` */
  onViewPlans?: () => void;
}

export function TermNoticeCard({ termName, notice, onViewPlans }: TermNoticeCardProps) {
  const color = TERM_NOTICE_COLOR[notice.tone];
  return (
    <Card accent={color} className="gap-sm" accessibilityLabel={`${termName}: ${notice.label}`}>
      <View className="flex-row items-center gap-sm">
        <View className="w-9 h-9 rounded-md items-center justify-center" style={{ backgroundColor: color + '22' }}>
          <Icon name={TERM_NOTICE_ICON[notice.tone]} size={20} color={color} />
        </View>
        <View className="flex-1 gap-xs">
          <Text className="text-md text-text-primary font-bevn-bold" numberOfLines={1}>{termName}</Text>
          <View className="flex-row flex-wrap gap-xs">
            <StatusBadge label={notice.label} color={color} />
            {notice.late && <StatusBadge label={LATE_REGISTRATION_TEXT.lateBadge} color={TERM_NOTICE_COLOR.success} />}
          </View>
        </View>
      </View>
      <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">{notice.message}</Text>
      {notice.suggestPlans && onViewPlans && (
        <Button title={LATE_REGISTRATION_TEXT.viewPlans} icon="card-membership" variant="secondary" size="sm" block={false} className="self-start" onPress={onViewPlans} />
      )}
    </Card>
  );
}
