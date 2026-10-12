// app/payment/[paymentId].tsx
// Thanh toán gói hội viên bằng chuyển khoản VietQR (SePay) — UI ở components/member/payment

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SepayPaymentView } from '../../components/member/payment/SepayPaymentView';

export default function PaymentScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const { user, currentFacility } = useAuth();
  return <SepayPaymentView paymentId={paymentId} scope={{ userId: user?.id, facilityId: currentFacility?.id }} />;
}
