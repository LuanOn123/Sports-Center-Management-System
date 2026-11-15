// components/profile/CoachInfoCard.tsx
// Thẻ "Thông tin Huấn luyện viên" ở hồ sơ (web: CoachProfile → cột tóm tắt): chuyên môn, kinh nghiệm, giới thiệu
// (do quản lý cập nhật — HLV chỉ xem).

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { PROFILE_SCREEN_TEXT as TEXT } from '../../constants/profile';
import { Colors } from '../../constants/theme';

export function CoachInfoCard() {
  const { user } = useAuth();
  const coach = user?.coachProfile;

  return (
    <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border shadow-sm">
      <Text className="text-md font-bold font-bevn-bold text-text-primary mb-md">{TEXT.coachCardTitle}</Text>
      <View className="gap-sm">
        <View className="flex-row items-center gap-1.5">
          <Icon name="fitness-center" size={16} color={Colors.primary} />
          <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.specialization}</Text>
          <Text className="text-sm font-semibold font-bevn-semibold text-text-primary flex-1">{coach?.specialization || TEXT.updating}</Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Icon name="workspace-premium" size={16} color={Colors.tier.PREMIUM} />
          <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.experience}</Text>
          <Text className="text-sm font-semibold font-bevn-semibold text-text-primary flex-1">
            {coach?.experienceYears ? TEXT.years(coach.experienceYears) : TEXT.updating}
          </Text>
        </View>

        {Boolean(coach?.bio) && (
          <View className="flex-row items-start gap-1.5">
            <Icon name="description" size={16} color={Colors.text.secondary} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.bio}</Text>
              <Text className="text-sm text-text-primary font-bevn-regular mt-0.5 leading-5">{coach!.bio}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
