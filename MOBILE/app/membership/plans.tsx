// app/membership/plans.tsx
// Gói thành viên của hội viên — UI ở components/member/membership

import React from 'react';
import { ScrollView, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { MembershipPlansView } from '../../components/member/membership/MembershipPlansView';
import { MissingMemberProfile } from '../../components/member/MissingMemberProfile';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { memberProfileIdOf } from '../../lib/businessRules';
import { Spacing } from '../../constants/theme';

export default function MembershipPlansScreen() {
  const { user, currentFacility } = useAuth();
  const memberId = memberProfileIdOf(user);

  // Thiếu hồ sơ hội viên → BE sẽ từ chối mua gói ("Member not found"), báo rõ thay vì gọi API sai
  if (!memberId) {
    return (
      <View className="flex-1 bg-bg-primary">
        <ScreenHeader title="Gói thành viên" />
        <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
          <MissingMemberProfile />
        </ScrollView>
      </View>
    );
  }

  return (
    <MembershipPlansView
      memberId={memberId}
      scope={{ userId: user?.id, facilityId: currentFacility?.id }}
    />
  );
}
