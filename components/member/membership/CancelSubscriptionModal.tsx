// components/member/membership/CancelSubscriptionModal.tsx
// Xác nhận hội viên tự hủy gói (đang dùng hoặc chờ kích hoạt) — câu chữ khớp web (shared/CancelSubscription):
// hoàn tiền là YÊU CẦU, chỉ được ghi nhận đã hoàn khi quầy xác nhận biên nhận thực tế.

import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../../../constants/theme';
import {
  CANCEL_REASON_MAX_LENGTH, CANCEL_SUBSCRIPTION_TEXT as TEXT, SELF_CANCEL_REFUND_RATE, SELF_CANCEL_REFUND_THRESHOLD_DAYS,
} from '../../../constants/membership';
import { ApiError } from '../../../lib/api';
import { cancelKindOf } from '../../../lib/businessRules';
import { formatVnd } from '../../../lib/format';
import type { CancelSubscriptionResult, Subscription } from '../../../lib/types';

interface CancelSubscriptionModalProps {
  visible: boolean;
  /** Gói đang hủy: gói đang dùng hoặc gói chờ kích hoạt */
  subscription: Subscription | null;
  estimate: { daysLeft: number; refundAmount: number } | null;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  result?: CancelSubscriptionResult;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}

const REFUND_PERCENT = Math.round(SELF_CANCEL_REFUND_RATE * 100);

export function CancelSubscriptionModal({
  visible, subscription, estimate, reason, onReasonChange, isPending, result, error, onConfirm, onClose,
}: CancelSubscriptionModalProps) {
  const scheduled = cancelKindOf(subscription) === 'SCHEDULED';
  const copy = scheduled ? TEXT.scheduled : TEXT.active;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-[rgba(0,0,0,0.75)] justify-center items-center p-xl"
        activeOpacity={1}
        onPress={isPending ? undefined : onClose}
      >
        <TouchableOpacity activeOpacity={1} className="w-full max-w-[400px] bg-bg-surface rounded-xl p-xl border border-border">
          <Text className="text-lg font-bevn-bold text-text-primary mb-md text-center">
            {result ? TEXT.doneTitle : TEXT.title}
          </Text>

          {result ? (
            <View className="gap-sm mb-lg">
              <Text className="text-sm text-status-active font-bevn-medium">{copy.done}</Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                {result.willRefund ? TEXT.refundRequested(formatVnd(result.refundAmount)) : TEXT.noRefund}
              </Text>
              {!scheduled && <Text className="text-sm text-text-secondary font-bevn-regular">{TEXT.daysLeftAtCancel(result.daysLeft)}</Text>}
            </View>
          ) : subscription && estimate ? (
            <View className="gap-sm mb-lg">
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Hủy <Text className="font-bevn-bold text-text-primary">{subscription.plan?.name ?? TEXT.defaultPlanName}</Text>{copy.consequence}
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                {scheduled ? TEXT.scheduled.policy : TEXT.active.policy(SELF_CANCEL_REFUND_THRESHOLD_DAYS, REFUND_PERCENT)}
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                {scheduled ? TEXT.scheduled.estimate : TEXT.active.estimate(estimate.daysLeft)}
                <Text className="font-bevn-bold text-text-primary">{formatVnd(estimate.refundAmount)}</Text>.
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">{TEXT.estimateNote}</Text>
              <View className="mt-sm">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.reasonLabel}</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-sm border border-border font-bevn-regular min-h-[80px]"
                  value={reason}
                  onChangeText={onReasonChange}
                  multiline
                  maxLength={CANCEL_REASON_MAX_LENGTH}
                  editable={!isPending}
                  placeholder={TEXT.reasonPlaceholder}
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
            </View>
          ) : null}

          {Boolean(error) && (
            <Text className="text-xs text-status-failed mb-md font-bevn-regular">
              {error instanceof ApiError ? error.message : TEXT.failed}
            </Text>
          )}

          <View className="flex-row gap-md">
            <TouchableOpacity className="flex-1 py-sm rounded-md items-center bg-bg-elevated border border-border" onPress={onClose} disabled={isPending}>
              <Text className="text-text-secondary font-bevn-semibold text-sm">{result ? TEXT.closeButton : TEXT.keepButton}</Text>
            </TouchableOpacity>
            {!result && (
              <TouchableOpacity className="flex-1 py-sm rounded-md items-center bg-status-failed" onPress={onConfirm} disabled={isPending}>
                {isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bevn-bold text-sm">{TEXT.confirmButton}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
