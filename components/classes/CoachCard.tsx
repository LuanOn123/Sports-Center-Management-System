// components/classes/CoachCard.tsx
// Thẻ huấn luyện viên trong chi tiết lớp (web: CoachCard) — bấm để xem hồ sơ & đánh giá.

import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { Card } from '../ui';
import { Colors } from '../../constants/theme';
import { COACH_PROFILE_TEXT as T } from '../../constants/coachProfile';
import { coachCardRole } from '../../lib/coachProfile';
import type { ClassCoach } from '../../lib/types';

export function CoachCard({ assigned, onPress }: { assigned: ClassCoach; onPress: () => void }) {
  const coach = assigned.coach;
  const name = coach?.user?.fullName || T.defaultName;
  return (
    <Card onPress={onPress} accessibilityLabel={`Xem hồ sơ ${name}`}>
      <View className="flex-row items-center gap-md">
        <Avatar name={name} size={48} />
        <View className="flex-1 gap-0.5">
          <Text className="text-xs text-primary font-bevn-bold tracking-wide">{coachCardRole(assigned.isPrimary)}</Text>
          <Text className="text-md text-text-primary font-bevn-bold" numberOfLines={1}>{name}</Text>
          <Text className="text-sm text-text-secondary font-bevn-regular" numberOfLines={1}>{coach?.specialization || T.defaultSpecialization}</Text>
          <View className="flex-row items-center gap-0.5 mt-xs">
            <Text className="text-sm text-primary font-bevn-semibold">{T.cardLink}</Text>
            <Icon name="chevron-right" size={16} color={Colors.primary} />
          </View>
        </View>
      </View>
    </Card>
  );
}
