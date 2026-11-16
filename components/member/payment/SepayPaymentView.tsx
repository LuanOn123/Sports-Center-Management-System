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
import type { BankApp } from '../../../services/vietqrService';
import { ApiError } from '../../../lib/api';
import { showAlert, showConfirm } from '../../../lib/alert';
import { bankAppLaunchNotice, saveQrNotice } from '../../../lib/bankAppLaunch';
import { Haptic } from '../../../lib/haptics';
import { BANK_APP_TEXT } from '../../../constants/payment';
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
  const { phase, checkout, bankApps } = flow;
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
    if (result === 'saved') Haptic.success();
    const notice = saveQrNotice(result);
    if (notice) showAlert(notice.title, notice.message);
  };

  const handleOpenBankApp = async (app: BankApp) => {
    const appName = app.appName.trim();
    const launch = await flow.prepareBankApp(app);
    const open = async () => {
      setPickerOpen(false);
      if (!(await launch.open())) showAlert(BANK_APP_TEXT.cannotOpenTitle, BANK_APP_TEXT.cannotOpen(appName));
    };
    // App tự điền: mở thẳng. App khác: báo hướng dẫn (hoặc lý do chưa lưu được QR) TRƯỚC khi rời app; bảng chọn vẫn mở tới lúc người dùng đồng ý
    // để hộp thoại không phải hiện ngay khi bảng đang đóng (iOS bỏ qua Modal mở chồng lúc Modal kia đang đóng).
    if (launch.qr === null) {
      await open();
      return;
    }
    if (launch.qr === 'saved') Haptic.success();
    const notice = bankAppLaunchNotice(appName, launch.qr);
    showConfirm(notice.title, notice.message, () => { void open(); }, undefined, notice.confirmText);
  };

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader title="Chuyển khoản VietQR" onBackPress={close} />

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
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void flow.reload(); }} tintColor={Colors.primary} />}
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
        isPreparing={flow.isSavingQr}
        isAutofill={bankApps.canAutofill}
        onSelect={handleOpenBankApp}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
