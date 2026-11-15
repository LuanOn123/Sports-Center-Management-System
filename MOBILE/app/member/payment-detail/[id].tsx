// app/member/payment-detail/[id].tsx — Chi tiết một khoản thanh toán (hội viên); giao diện ở components/member/PaymentDetailView
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PaymentDetailView } from '../../../components/member/PaymentDetailView';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentDetailView id={id} />;
}
