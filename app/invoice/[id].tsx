// app/invoice/[id].tsx — Một hóa đơn (hội viên); giao diện ở components/member/InvoiceView
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { InvoiceView } from '../../components/member/InvoiceView';

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InvoiceView id={id} />;
}
