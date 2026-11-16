// hooks/member/useBankApps.ts
// Danh sách app ngân hàng + mở app kèm thông tin chuyển khoản (VietQR deeplink — tham số và giới hạn: xem lib/vietqr).
// Lỗi tải danh sách (VietQR không phản hồi) → isAvailable=false, màn thanh toán chỉ ẩn nút này.

import { useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getBankApps, getVietQrBanks, type BankApp } from '../../services/vietqrService';
import { PAYMENT_RETURN_URL_ENV, VIETQR_DIRECTORY_STALE_MS } from '../../constants/payment';
import { BASE_URL } from '../../lib/api';
import {
  buildBankAppDeeplink, isAutofillReady, resolvePaymentReturnUrl, resolveVietQrBankCode, sortBankApps, type TransferInfo,
} from '../../lib/vietqr';
import type { SepayCheckout } from '../../lib/types';

/** Đường dẫn "quay lại" gửi kèm deeplink — giống nhau cho mọi đơn nên chỉ tính một lần */
const RETURN_URL = resolvePaymentReturnUrl(PAYMENT_RETURN_URL_ENV, BASE_URL);

export function useBankApps(checkout: SepayCheckout | undefined) {
  const enabled = Platform.OS !== 'web'; // web (máy tính) không mở được app ngân hàng

  const appsQuery = useQuery({
    queryKey: ['vietqr', 'bank-apps', Platform.OS],
    queryFn: getBankApps,
    enabled,
    staleTime: VIETQR_DIRECTORY_STALE_MS,
    retry: 1,
  });
  const banksQuery = useQuery({
    queryKey: ['vietqr', 'banks'],
    queryFn: getVietQrBanks,
    enabled,
    staleTime: VIETQR_DIRECTORY_STALE_MS,
    retry: 1,
  });

  const apps = useMemo(() => sortBankApps(appsQuery.data ?? []), [appsQuery.data]);
  const bankCode = resolveVietQrBankCode(checkout?.bank?.id, banksQuery.data ?? []);

  const info: TransferInfo | null = checkout
    ? {
        accountNumber: checkout.bank?.accountNumber,
        bankCode,
        accountHolder: checkout.bank?.accountHolder,
        amount: checkout.amount,
        content: checkout.transferContent,
        returnUrl: RETURN_URL,
      }
    : null;

  /** App này mở ra là có sẵn số tiền + nội dung (người dùng chỉ cần đăng nhập và xác nhận)? */
  const canAutofill = (app: BankApp) => info !== null && isAutofillReady(app, info);

  /** Mở app ngân hàng; trả về false nếu máy không mở được link */
  const openApp = async (app: BankApp) => {
    if (!info) return false;
    try {
      await Linking.openURL(buildBankAppDeeplink(app, info));
      return true;
    } catch {
      return false;
    }
  };

  return {
    apps,
    isAvailable: enabled && apps.length > 0,
    isLoading: appsQuery.isLoading,
    canAutofill,
    openApp,
  };
}
