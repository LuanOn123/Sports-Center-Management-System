// components/shared/WrongFacilityCard.tsx
// Thẻ thay cho lỗi "không có quyền truy cập cơ sở" khi mở lớp / buổi học của cơ sở khác (thường từ thông báo):
// nói rõ dữ liệu thuộc cơ sở nào và cho chuyển sang cơ sở đó một chạm (logic ở hooks/shared/useOwningFacility).

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Icon } from './Icon';
import { Button, Card } from '../ui';
import { Colors } from '../../constants/theme';
import { WRONG_FACILITY_TEXT, type ScopedSubject } from '../../constants/facility';
import { wrongFacilityBody } from '../../lib/facilityScope';
import type { useOwningFacility } from '../../hooks/shared/useOwningFacility';

interface WrongFacilityCardProps {
  subject: ScopedSubject;
  facility: ReturnType<typeof useOwningFacility>;
  onBack: () => void;
}

export function WrongFacilityCard({ subject, facility, onBack }: WrongFacilityCardProps) {
  const { owner, currentFacility, probing, switchToOwner } = facility;
  const body = wrongFacilityBody({ subject, currentName: currentFacility?.name, ownerName: owner?.name, probing });
  return (
    <Card accent={Colors.status.pending} className="gap-md">
      <View className="flex-row items-start gap-sm">
        <Icon name="place" size={20} color={Colors.status.pending} style={{ marginTop: 2 }} />
        <View className="flex-1 gap-xs">
          <Text className="text-md text-text-primary font-bevn-bold">{WRONG_FACILITY_TEXT.title}</Text>
          <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">{body}</Text>
        </View>
        {probing && <ActivityIndicator color={Colors.primary} />}
      </View>
      {owner && <Button title={WRONG_FACILITY_TEXT.switchTo(owner.name)} icon="swap-horiz" onPress={() => { void switchToOwner(); }} />}
      {!probing && <Button title={WRONG_FACILITY_TEXT.back} variant="secondary" onPress={onBack} />}
    </Card>
  );
}
