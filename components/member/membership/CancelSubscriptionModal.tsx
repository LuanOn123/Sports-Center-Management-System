// components/member/membership/CancelSubscriptionModal.tsx
// Xác nhận hội viên tự hủy gói — điều khoản hoàn tiền + lý do hủy (không bắt buộc)

import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../../../constants/theme';
import {
  CANCEL_REASON_MAX_LENGTH, SELF_CANCEL_REFUND_RATE, SELF_CANCEL_REFUND_THRESHOLD_DAYS,
} from '../../../constants/membership';
import { ApiError } from '../../../lib/api';
import { formatVnd } from '../../../lib/format';
import type { CancelSubscriptionResult, Subscription } from '../../../lib/types';

interface CancelSubscriptionModalProps {
  visible: boolean;
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-[rgba(0,0,0,0.75)] justify-center items-center p-xl"
        activeOpacity={1}
        onPress={isPending ? undefined : onClose}
      >
        <TouchableOpacity activeOpacity={1} className="w-full max-w-[400px] bg-bg-surface rounded-xl p-xl border border-border">
          <Text className="text-lg font-bevn-bold text-text-primary mb-md text-center">
            {result ? 'Đã hủy gói tập' : 'Xác nhận hủy gói tập'}
          </Text>

          {result ? (
            <View className="gap-sm mb-lg">
              <Text className="text-sm text-status-active font-bevn-medium">Gói tập và các lượt đặt lớp tương lai đã được hủy.</Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                {result.willRefund
                  ? `Số tiền hoàn: ${formatVnd(result.refundAmount)}. Vui lòng liên hệ quầy để nhận tiền.`
                  : 'Không phát sinh hoàn tiền.'}
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">Còn {result.daysLeft} ngày tại thời điểm hủy.</Text>
            </View>
          ) : subscription && estimate ? (
            <View className="gap-sm mb-lg">
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Hủy <Text className="font-bevn-bold text-text-primary">{subscription.plan?.name ?? 'gói tập'}</Text> sẽ chấm dứt quyền lợi và hủy toàn bộ lượt đặt lớp trong tương lai.
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Còn trên {SELF_CANCEL_REFUND_THRESHOLD_DAYS} ngày: hoàn {REFUND_PERCENT}% khoản thanh toán gốc. Còn từ {SELF_CANCEL_REFUND_THRESHOLD_DAYS} ngày trở xuống: không hoàn tiền.
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Dự kiến còn {estimate.daysLeft} ngày · Hoàn khoảng <Text className="font-bevn-bold text-text-primary">{formatVnd(estimate.refundAmount)}</Text>.
              </Text>
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Ước tính theo giá gói hiện tại. Số tiền chính thức được xác định theo khoản thanh toán gốc và thời điểm xác nhận.
              </Text>
              <View className="mt-sm">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Lý do hủy (không bắt buộc)</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-sm border border-border font-bevn-regular min-h-[80px]"
                  value={reason}
                  onChangeText={onReasonChange}
                  multiline
                  maxLength={CANCEL_REASON_MAX_LENGTH}
                  editable={!isPending}
                  placeholder="Nhập lý do (nếu có)..."
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
            </View>
          ) : null}

          {Boolean(error) && (
            <Text className="text-xs text-status-failed mb-md font-bevn-regular">
              {error instanceof ApiError ? error.message : 'Hủy gói thất bại. Vui lòng thử lại.'}
            </Text>
          )}

          <View className="flex-row gap-md">
            <TouchableOpacity className="flex-1 py-sm rounded-md items-center bg-bg-elevated border border-border" onPress={onClose} disabled={isPending}>
              <Text className="text-text-secondary font-bevn-semibold text-sm">{result ? 'Đóng' : 'Giữ gói tập'}</Text>
            </TouchableOpacity>
            {!result && (
              <TouchableOpacity className="flex-1 py-sm rounded-md items-center bg-status-failed" onPress={onConfirm} disabled={isPending}>
                {isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bevn-bold text-sm">Xác nhận hủy gói</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
