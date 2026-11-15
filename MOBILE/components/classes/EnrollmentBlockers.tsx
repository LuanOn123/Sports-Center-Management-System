// components/classes/EnrollmentBlockers.tsx
// Thẻ "vì sao chưa đăng ký được" ở chi tiết lớp (web: AlertBanner + blockerList trong ClassDetailPage): tiêu đề, mọi điều kiện
// BE nêu và nút gỡ vướng (xem gói / mua / nâng cấp / gia hạn / xem các lớp đang giữ). Dùng cho cả hai trường hợp: BE báo
// chưa đủ điều kiện (course-plan) và lần đăng ký vừa bị từ chối (409).

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { Button, Card } from '../ui';
import { Colors } from '../../constants/theme';
import { ENROLL_TEXT, type EnrollAction } from '../../constants/enrollment';
import type { BlockerGuidance } from '../../lib/enrollmentBlockers';
import type { CourseRegistrationBlocker } from '../../lib/types';

interface EnrollmentBlockersProps {
  title: string;
  /** Lời của BE hoặc gợi ý ngắn dưới tiêu đề */
  message?: string;
  blockers: readonly CourseRegistrationBlocker[];
  guidance: BlockerGuidance;
  /** Nút gỡ vướng hiện trong thẻ — việc đã có nút cố định ở đáy màn hình thì không lặp lại */
  actions: readonly EnrollAction[];
  onAction: (action: EnrollAction) => void;
  tone?: 'warning' | 'error';
}

export function EnrollmentBlockers({ title, message, blockers, guidance, actions, onAction, tone = 'warning' }: EnrollmentBlockersProps) {
  const color = tone === 'error' ? Colors.status.failed : Colors.status.pending;
  return (
    <Card accent={color} className="gap-sm" accessibilityLabel={title}>
      <View className="flex-row items-start gap-sm">
        <Icon name={tone === 'error' ? 'error-outline' : 'info'} size={18} color={color} style={{ marginTop: 2 }} />
        <View className="flex-1 gap-xs">
          <Text accessibilityRole="alert" className="text-md text-text-primary font-bevn-bold">{title}</Text>
          {Boolean(message) && <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">{message}</Text>}
        </View>
      </View>

      {blockers.map((blocker, index) => (
        <View key={`${blocker.code}:${blocker.sessionId ?? index}`} className="flex-row items-start gap-sm pl-xs">
          <Text className="text-sm text-text-secondary font-bevn-regular">•</Text>
          <Text className="flex-1 text-sm text-text-primary font-bevn-regular leading-[20px]">{blocker.message}</Text>
        </View>
      ))}

      {guidance.contactManager && (
        <Text className="text-sm text-text-secondary font-bevn-medium leading-[20px]">{ENROLL_TEXT.contactManager}</Text>
      )}

      {actions.length > 0 && (
        <View className="flex-row flex-wrap gap-sm mt-xs">
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              block={false}
              variant={action === 'held' ? 'secondary' : 'primary'}
              title={ENROLL_TEXT.action[action]}
              onPress={() => onAction(action)}
            />
          ))}
        </View>
      )}
    </Card>
  );
}
