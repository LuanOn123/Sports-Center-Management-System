// components/member/payment/SepayCheckoutPanel.tsx
// Đơn đang chờ / hết hạn / thất bại: QR, thông tin chuyển khoản, thông báo và nút hành động
// (web: nhánh còn lại của SepayCheckoutModal)

import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../../shared/Icon';
import { InfoBanner } from '../../shared/InfoBanner';
import { InfoRow } from '../../shared/InfoRow';
import { Colors } from '../../../constants/theme';
import { SEPAY_MOCK_ENABLED, SEPAY_QR_SIZE } from '../../../constants/payment';
import { formatVnd } from '../../../lib/format';
import type { SepayCheckout } from '../../../lib/types';

interface SepayCheckoutPanelProps {
  checkout: SepayCheckout;
  phase: 'pending' | 'expired' | 'failed';
  countdownLabel: string;
  isChecking: boolean;
  pollError: boolean;
  isCreatingNew: boolean;
  isMocking: boolean;
  mockErrorMessage?: string;
  onCheckAgain: () => void;
  onCreateNew: () => void;
  isSavingQr: boolean;
  /** Có app ngân hàng để mở (VietQR deeplink) */
  canOpenBankApp: boolean;
  onSaveQr: () => void;
  onOpenBankApp: () => void;
  onCopy: (label: string, value: string) => void;
  onMockConfirm: () => void;
}

export function SepayCheckoutPanel({
  checkout, phase, countdownLabel, isChecking, pollError, isCreatingNew, isMocking, mockErrorMessage,
  isSavingQr, canOpenBankApp, onCheckAgain, onCreateNew, onSaveQr, onOpenBankApp, onCopy, onMockConfirm,
}: SepayCheckoutPanelProps) {
  const isPending = phase === 'pending';

  return (
    <View>
      {/* Gói & số tiền */}
      <View className="flex-row justify-between items-center bg-bg-surface rounded-xl p-lg mb-lg border border-border">
        <View className="flex-1 mr-md">
          <Text className="text-md font-bevn-bold text-text-primary" numberOfLines={2}>{checkout.plan?.name ?? 'Gói hội viên'}</Text>
          {Boolean(checkout.plan?.durationDays) && (
            <Text className="text-xs text-text-muted font-bevn-regular mt-0.5">Thời hạn {checkout.plan!.durationDays} ngày</Text>
          )}
        </View>
        <Text className="text-lg font-bevn-bold text-primary">{formatVnd(checkout.amount)}</Text>
      </View>

      {/* QR */}
      {isPending && (
        <View className="items-center mb-lg">
          <View className="bg-white rounded-xl p-md">
            <Image
              source={{ uri: checkout.qrUrl }}
              style={{ width: SEPAY_QR_SIZE, height: SEPAY_QR_SIZE }}
              resizeMode="contain"
              accessibilityLabel="Mã VietQR thanh toán gói hội viên"
            />
          </View>
          <Text className="text-sm text-text-secondary font-bevn-regular mt-sm">
            Mã hết hạn sau <Text className="text-text-primary font-bevn-bold">{countdownLabel}</Text>
          </Text>
          <View className="flex-row gap-md mt-md self-stretch">
            <TouchableOpacity
              className="flex-1 flex-row justify-center items-center gap-1.5 bg-bg-surface rounded-md py-sm border border-border"
              onPress={onSaveQr}
              disabled={isSavingQr}
            >
              {isSavingQr ? <ActivityIndicator color={Colors.text.secondary} size="small" /> : <Icon name="download" size={16} color={Colors.text.secondary} />}
              <Text className="text-text-secondary font-bevn-semibold text-sm">Lưu mã QR</Text>
            </TouchableOpacity>
            {canOpenBankApp && (
              <TouchableOpacity className="flex-1 flex-row justify-center items-center gap-1.5 bg-primary rounded-md py-sm" onPress={onOpenBankApp}>
                <Icon name="account-balance" size={16} color={Colors.text.inverse} />
                <Text className="text-text-inverse font-bevn-bold text-sm">Mở app ngân hàng</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Thông tin chuyển khoản */}
      <View className="bg-bg-surface rounded-xl px-lg py-xs mb-lg border border-border">
        {checkout.bank && (
          <>
            <InfoRow label="Ngân hàng" value={checkout.bank.id} />
            <InfoRow label="Số tài khoản" value={checkout.bank.accountNumber} onCopy={() => onCopy('số tài khoản', checkout.bank!.accountNumber)} />
            <InfoRow label="Chủ tài khoản" value={checkout.bank.accountHolder} />
          </>
        )}
        <InfoRow label="Số tiền" value={formatVnd(checkout.amount)} onCopy={() => onCopy('số tiền', String(Math.round(checkout.amount)))} />
        <InfoRow label="Nội dung" value={checkout.transferContent} highlight onCopy={() => onCopy('nội dung chuyển khoản', checkout.transferContent)} />
      </View>

      {/* Thông báo theo trạng thái */}
      {isPending && (
        <InfoBanner
          tone="info"
          title="Đang chờ ngân hàng xác nhận"
          message="Hệ thống đang chờ xác nhận từ ngân hàng. Nếu đã chuyển tiền, không chuyển lại. Vui lòng giữ biên lai và mã đơn để trung tâm đối soát nếu trạng thái chưa cập nhật."
        />
      )}
      {phase === 'expired' && (
        <InfoBanner tone="warning" title="Đơn thanh toán đã hết thời gian" message="Bạn có thể tạo đơn mới để nhận mã VietQR còn hiệu lực." />
      )}
      {phase === 'failed' && (
        <InfoBanner tone="error" title="Thanh toán thất bại" message="Giao dịch không thành công. Vui lòng tạo đơn thanh toán mới." />
      )}
      {pollError && isPending && (
        <InfoBanner tone="warning" title="Chưa kiểm tra được trạng thái" message="Kết nối tạm thời gián đoạn. Bạn có thể kiểm tra lại thủ công." />
      )}
      {Boolean(mockErrorMessage) && (
        <InfoBanner tone="error" title="Không thể giả lập thanh toán" message={mockErrorMessage} />
      )}

      {/* Hành động */}
      {isPending ? (
        <TouchableOpacity
          key="check-again"
          className="flex-row justify-center items-center gap-1.5 rounded-md p-md border border-border"
          onPress={onCheckAgain}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color={Colors.text.secondary} size="small" />
          ) : (
            <Icon name="refresh" size={16} color={Colors.text.secondary} />
          )}
          <Text className="text-text-secondary font-bevn-semibold text-sm">{isChecking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity key="create-new" className="bg-primary rounded-md p-md items-center" onPress={onCreateNew} disabled={isCreatingNew}>
          {isCreatingNew ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text className="text-text-inverse font-bevn-bold text-md">Tạo đơn mới</Text>
          )}
        </TouchableOpacity>
      )}

      {SEPAY_MOCK_ENABLED && isPending && (
        <TouchableOpacity
          className="flex-row justify-center items-center gap-1.5 rounded-md p-md mt-md border border-dashed border-border"
          onPress={onMockConfirm}
          disabled={isMocking}
        >
          {isMocking && <ActivityIndicator color={Colors.text.secondary} size="small" />}
          <Text className="text-text-secondary font-bevn-medium text-sm">DEV: giả lập SePay đã thu tiền</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
