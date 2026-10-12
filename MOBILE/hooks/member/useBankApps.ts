// hooks/member/useBankApps.ts
// Danh sách app ngân hàng + mở app kèm thông tin chuyển khoản (VietQR deeplink).
// Lỗi tải danh sách (VietQR không phản hồi) → isAvailable=false, màn thanh toán chỉ ẩn nút này.

import { useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getBankApps, getVietQrBanks, type BankApp } from '../../services/vietqrService';
import { VIETQR_DIRECTORY_STALE_MS } from '../../constants/payment';
import { buildBankAppDeeplink, resolveVietQrBankCode, sortBankApps } from '../../lib/vietqr';
import type { SepayCheckout } from '../../lib/types';

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

  /** Mở app ngân hàng; trả về false nếu máy không mở được link */
  const openApp = async (app: BankApp) => {
    if (!checkout) return false;
    const url = buildBankAppDeeplink(app, {
      accountNumber: checkout.bank?.accountNumber,
      bankCode,
      amount: checkout.amount,
      content: checkout.transferContent,
    });
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  };

  return {
    apps,
    isAvailable: enabled && apps.length > 0,
    isLoading: appsQuery.isLoading,
    openApp,
  };
}
