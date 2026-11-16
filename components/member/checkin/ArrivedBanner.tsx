// components/member/checkin/ArrivedBanner.tsx
// Báo hội viên vừa được ghi nhận vào cửa (thường là lúc lễ tân vừa quét mã QR) — hiện trên đầu màn Check-in

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../shared/Icon';
import { Colors } from '../../../constants/theme';
import { CHECKIN_TEXT, VISIT_METHOD_RECEPTION } from '../../../constants/workflow';
import { formatTime } from '../../../lib/format';
import type { FacilityVisit } from '../../../services/workflowService';

export function ArrivedBanner({ visit, onDismiss }: { visit: FacilityVisit; onDismiss: () => void }) {
  const facility = visit.facility?.name || CHECKIN_TEXT.facilityFallback;
  const time = formatTime(visit.checkInAt);
  const message = visit.method === VISIT_METHOD_RECEPTION ? CHECKIN_TEXT.arrivedByReception(time, facility) : CHECKIN_TEXT.arrived(time, facility);

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-md rounded-xl p-lg border-[1.5px]"
      style={{ backgroundColor: Colors.status.success + '15', borderColor: Colors.status.success + '60' }}
    >
      <Icon name="check-circle" size={22} color={Colors.status.success} />
      <Text className="flex-1 text-sm font-bevn-semibold text-text-primary">{message}</Text>
      <TouchableOpacity onPress={onDismiss} accessibilityRole="button" accessibilityLabel={CHECKIN_TEXT.dismiss} hitSlop={8}>
        <Icon name="close" size={18} color={Colors.text.muted} />
      </TouchableOpacity>
    </View>
  );
}
