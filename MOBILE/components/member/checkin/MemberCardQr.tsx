// components/member/checkin/MemberCardQr.tsx
// Thẻ hội viên QR: mã chứa userId (lib/memberCard), lễ tân quét để ghi nhận hội viên đã đến cơ sở.
// Mã luôn nền trắng kèm vùng trắng quanh mã để máy quét đọc được cả khi giao diện tối.

import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Avatar } from '../../shared/Avatar';
import { WorkflowCard, WorkflowText } from '../../shared/WorkflowScreen';
import { CHECKIN_QR_QUIET_ZONE, CHECKIN_QR_SIZE, CHECKIN_TEXT } from '../../../constants/workflow';

export interface MemberCard {
  name: string;
  avatarUrl?: string | null;
  /** Nội dung mã QR; null khi thiếu userId */
  payload: string | null;
}

export function MemberCardQr({ card }: { card: MemberCard }) {
  return (
    <WorkflowCard title={CHECKIN_TEXT.qrTitle}>
      <View className="flex-row items-center gap-md">
        <Avatar uri={card.avatarUrl} name={card.name} size={44} />
        <Text className="flex-1 text-md font-bevn-bold text-text-primary" numberOfLines={1}>{card.name}</Text>
      </View>
      {card.payload ? (
        <View className="items-center py-xs" accessible accessibilityRole="image" accessibilityLabel={CHECKIN_TEXT.qrLabel(card.name)}>
          <QRCode value={card.payload} size={CHECKIN_QR_SIZE} quietZone={CHECKIN_QR_QUIET_ZONE} />
        </View>
      ) : (
        <WorkflowText>{CHECKIN_TEXT.qrMissing}</WorkflowText>
      )}
      <WorkflowText>{CHECKIN_TEXT.qrIntro}</WorkflowText>
    </WorkflowCard>
  );
}
