// components/member/payment/SepayPaymentView.tsx
// Màn thanh toán VietQR qua SePay — render theo `phase` của useSepayPaymentFlow

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../shared/Icon';
import { ScreenHeader } from '../../shared/ScreenHeader';
import { SepayCheckoutPanel } from './SepayCheckoutPanel';
import { SepayReviewPanel } from './SepayReviewPanel';
import { SepaySuccessPanel } from './SepaySuccessPanel';
import { BankAppPickerModal } from './BankAppPickerModal';
import { useSepayPaymentFlow, type PaymentScope } from '../../../hooks/member/usePayment';
import { useBankApps } from '../../../hooks/member/useBankApps';
import type { BankApp } from '../../../services/vietqrService';
import { ApiError } from '../../../lib/api';
import { showAlert } from '../../../lib/alert';
import { Haptic } from '../../../lib/haptics';
import { Colors } from '../../../constants/theme';
import { ROUTES } from '../../../navigation/routes';

interface SepayPaymentViewProps {
  paymentId: string | undefined;
  scope: PaymentScope;
}

const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function SepayPaymentView({ paymentId, scope }: SepayPaymentViewProps) {
  const router = useRouter();
  const flow = useSepayPaymentFlow(paymentId, scope);
  const { phase, checkout } = flow;
  const bankApps = useBankApps(checkout);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (phase === 'success') Haptic.success();
    else if (phase === 'failed') Haptic.error();
  }, [phase]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.membershipPlans);
  };

  const handleCheckAgain = async () => {
    Haptic.light();
    const stillPending = await flow.checkAgain();
    if (stillPending && checkout) {
      showAlert(
        'Chưa nhận được tiền',
        `Đơn ${checkout.orderCode} vẫn đang chờ xác nhận. Nếu đã chuyển tiền, vui lòng liên hệ trung tâm để đối soát.`
      );
    }
  };

  const handleCreateNew = () => {
    Haptic.medium();
    const started = flow.createNew(
      (next) => router.replace(ROUTES.payment(next.paymentId)),
      (e) => showAlert('Không tạo được đơn mới', errorMessage(e, 'Vui lòng thử lại sau.')),
    );
    if (!started) router.replace(ROUTES.membershipPlans);
  };

  const handleCopy = async (label: string, value: string) => {
    const ok = await flow.copy(value);
    if (ok) Haptic.success();
    else showAlert('Không sao chép được', 'Vui lòng nhấn giữ vào chữ để sao chép thủ công.');
  };

  const handleSaveQr = async () => {
    const result = await flow.saveQr();
    if (result === 'saved') {
      Haptic.success();
      showAlert('Đã lưu mã QR', 'Mở app ngân hàng → Quét QR → chọn ảnh vừa lưu trong thư viện.');
    } else if (result === 'unavailable') {
      showAlert('Cần cập nhật ứng dụng', 'Bản app hiện tại chưa hỗ trợ lưu ảnh. Vui lòng cập nhật app, hoặc dùng nút sao chép thông tin chuyển khoản.');
    } else if (result === 'denied') {
      showAlert('Chưa có quyền lưu ảnh', 'Hãy cho phép Pulse lưu ảnh trong Cài đặt, hoặc dùng nút sao chép thông tin chuyển khoản.');
    } else if (result === 'failed') {
      showAlert('Không lưu được mã QR', 'Vui lòng thử lại hoặc chuyển khoản thủ công theo thông tin bên dưới.');
    }
  };

  const handleOpenBankApp = async (app: BankApp) => {
    setPickerOpen(false);
    const opened = await bankApps.openApp(app);
    if (!opened) showAlert('Không mở được app', `Máy chưa cài ${app.appName.trim()} hoặc app không hỗ trợ mở nhanh.`);
  };


  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title="Chuyển khoản VietQR"
        subtitle={checkout ? `Mã đơn ${checkout.orderCode}` : undefined}
        onBackPress={close}
      />

      {phase === 'loading' ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : phase === 'error' || !checkout ? (
        <View className="flex-1 justify-center items-center p-xl">
          <Icon name="error-outline" size={40} color={Colors.status.failed} />
          <Text className="text-md text-text-primary font-bevn-semibold mt-md text-center">
            {errorMessage(flow.loadError, 'Không tải được đơn thanh toán.')}
          </Text>
          <TouchableOpacity className="mt-lg bg-primary rounded-md px-xl py-sm" onPress={() => flow.reload()}>
            <Text className="text-text-inverse font-bevn-bold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => flow.reload()} tintColor={Colors.primary} />}
        >
          {phase === 'review' ? (
            <SepayReviewPanel checkout={checkout} isChecking={flow.isFetching} onCheckAgain={handleCheckAgain} onClose={close} />
          ) : phase === 'success' ? (
            <SepaySuccessPanel checkout={checkout} onClose={close} />
          ) : (
            <SepayCheckoutPanel
              checkout={checkout}
              phase={phase}
              countdownLabel={flow.countdown.label}
              isChecking={flow.isFetching}
              pollError={flow.pollError}
              isCreatingNew={flow.isCreatingNew}
              isMocking={flow.mockConfirm.isPending}
              mockErrorMessage={
                flow.mockConfirm.isError
                  ? errorMessage(flow.mockConfirm.error, 'Chế độ thanh toán thử nghiệm chưa được bật. Liên hệ quản trị viên để kiểm tra.')
                  : undefined
              }
              onCheckAgain={handleCheckAgain}
              onCreateNew={handleCreateNew}
              isSavingQr={flow.isSavingQr}
              canOpenBankApp={bankApps.isAvailable}
              onSaveQr={handleSaveQr}
              onOpenBankApp={() => setPickerOpen(true)}
              onCopy={handleCopy}
              onMockConfirm={() => flow.mockConfirm.mutate()}
            />
          )}
        </ScrollView>
      )}

      <BankAppPickerModal
        visible={pickerOpen}
        apps={bankApps.apps}
        isLoading={bankApps.isLoading}
        isSavingQr={flow.isSavingQr}
        onSaveQr={handleSaveQr}
        onSelect={handleOpenBankApp}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
