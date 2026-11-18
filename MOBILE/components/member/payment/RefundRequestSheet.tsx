// components/member/payment/RefundRequestSheet.tsx
// Bảng "Yêu cầu hoàn tiền" (web: MemberRefundDialog): ghi lý do → gửi → báo lễ tân phụ trách hoàn tiền kèm nút nhắn tin.
// Logic ở hooks/member/useRefundRequest.

import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { BottomSheet } from '../../shared/BottomSheet';
import { Icon } from '../../shared/Icon';
import { WorkflowState } from '../../shared/WorkflowScreen';
import { Button } from '../../ui/Button';
import { Colors } from '../../../constants/theme';
import { REFUND_POLICY_DAYS, REFUND_REASON_MAX_LENGTH, REFUND_TEXT as TEXT } from '../../../constants/refund';
import { formatVnd } from '../../../lib/format';
import { isRefundReasonValid, paymentCode } from '../../../lib/refund';
import type { RefundRequestState } from '../../../hooks/member/useRefundRequest';
import type { RefundReceptionist } from '../../../services/workflowService';

interface RefundRequestSheetProps {
  refund: RefundRequestState;
  /** Mở cuộc trò chuyện với lễ tân phụ trách (màn gọi dựng tin nhắn soạn sẵn) */
  onChat: (receptionist: RefundReceptionist) => void;
}

export function RefundRequestSheet({ refund, onChat }: RefundRequestSheetProps) {
  const { target, done } = refund;
  const busy = refund.isPending;
  const reasonTooShort = refund.reason.length > 0 && !isRefundReasonValid(refund.reason);

  return (
    <BottomSheet
      visible={Boolean(target)}
      title={TEXT.title}
      onClose={refund.close}
      dismissible={!busy}
      footer={
        done ? (
          <View className="gap-sm">
            {done.receptionist && <Button icon="chat" title={TEXT.chatWithReceptionist} onPress={() => onChat(done.receptionist!)} />}
            <Button variant="secondary" title={TEXT.close} onPress={refund.close} />
          </View>
        ) : (
          <View className="flex-row gap-md">
            <Button className="flex-1" variant="secondary" title={TEXT.cancel} onPress={refund.close} disabled={busy} />
            <Button
              className="flex-[2]"
              title={busy ? TEXT.submitting : TEXT.submit}
              loading={busy}
              disabled={!refund.canSubmit}
              onPress={refund.submit}
            />
          </View>
        )
      }
    >
      {done ? (
        <View className="items-center gap-sm py-md">
          <Icon name="check-circle" size={40} color={Colors.status.success} />
          <Text className="text-md text-status-active font-bevn-bold text-center">{done.message || TEXT.doneFallback}</Text>
          {done.receptionist ? (
            <Text className="text-sm text-text-secondary font-bevn-regular text-center">
              {TEXT.receptionist}: <Text className="text-text-primary font-bevn-bold">{done.receptionist.fullName}</Text>
            </Text>
          ) : (
            <Text className="text-sm text-text-secondary font-bevn-regular text-center leading-[20px]">{TEXT.noReceptionist}</Text>
          )}
        </View>
      ) : target ? (
        <>
          <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">
            {TEXT.summary(paymentCode(target.paymentId), formatVnd(target.amount))}
          </Text>
          <Text className="text-xs text-text-muted font-bevn-regular leading-[18px]">{TEXT.policy(REFUND_POLICY_DAYS)}</Text>
          <View className="gap-xs">
            <Text className="text-sm text-text-secondary font-bevn-medium">
              {TEXT.reasonLabel}
              <Text className="text-status-failed font-bevn-medium">{' *'}</Text>
            </Text>
            <TextInput
              accessibilityLabel={TEXT.reasonLabel}
              value={refund.reason}
              onChangeText={refund.setReason}
              editable={!busy}
              multiline
              maxLength={REFUND_REASON_MAX_LENGTH}
              placeholder={TEXT.reasonPlaceholder}
              placeholderTextColor={Colors.text.muted}
              textAlignVertical="top"
              className="bg-bg-elevated border border-border rounded-md p-md text-text-primary text-md font-bevn-regular min-h-[104px]"
            />
            <View className="flex-row justify-between">
              <Text className="flex-1 text-xs text-status-failed font-bevn-regular">{reasonTooShort ? TEXT.reasonTooShort : ''}</Text>
              <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.counter(refund.reason.trim().length)}</Text>
            </View>
          </View>
          <WorkflowState error={refund.error} />
        </>
      ) : null}
    </BottomSheet>
  );
}
