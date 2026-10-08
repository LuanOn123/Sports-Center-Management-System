// hooks/member/usePayment.ts
// Business logic thanh toán gói hội viên qua SePay — theo đúng luồng FE web
// (FE/src/pages/member/MembershipPage.tsx + FE/src/shared/SepayCheckout.tsx)

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import {
  createSepayCheckout, getSepayCheckout, mockConfirmSepay, pendingCheckoutFromError,
} from '../../services/paymentService';
import { useCountdown } from '../shared/useCountdown';
import { QR_IMAGE_FILE_PREFIX, SEPAY_POLL_INTERVAL_MS } from '../../constants/payment';
import { ApiError } from '../../lib/api';
import { storage } from '../../lib/storage';
import { copyToClipboard, saveRemoteImageToLibrary, type SaveImageResult } from '../../lib/device';
import type { SepayCheckout } from '../../lib/types';

/** Đơn thanh toán thuộc hội viên + cơ sở nào (BE scope đơn theo cơ sở) */
export interface PaymentScope {
  userId?: string;
  facilityId?: string;
}

export const sepayCheckoutKey = (paymentId: string | undefined) => ['sepay-checkout', paymentId] as const;

/** Tiền đã về nhưng gói chưa kích hoạt được — chờ trung tâm đối soát */
export function requiresReview(checkout: SepayCheckout) {
  return Boolean(checkout.requiresReview || checkout.activationStatus === 'REQUIRES_REVIEW');
}

/** Thanh toán xong và gói đã kích hoạt (web: onConfirmed) */
export function isConfirmed(checkout: SepayCheckout) {
  return checkout.status === 'SUCCESS' && !requiresReview(checkout);
}

function invalidateAfterConfirmed(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  queryClient.invalidateQueries({ queryKey: ['membership-plans-active'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
}

async function savePending(scope: PaymentScope, paymentId: string) {
  if (scope.userId) await storage.setPendingPaymentId(scope.userId, scope.facilityId ?? '', paymentId);
}

async function clearPending(scope: PaymentScope) {
  if (scope.userId) await storage.clearPendingPaymentId(scope.userId, scope.facilityId ?? '');
}

// ─── Tạo đơn ──────────────────────────────────────────────────────────────────

/**
 * Tạo đơn VietQR cho gói. BE báo còn đơn chờ cho cùng gói (409 SEPAY_PAYMENT_PENDING)
 * thì dùng lại đơn đó — giống web.
 */
export function useStartCheckout(scope: PaymentScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string): Promise<SepayCheckout> => {
      try {
        return (await createSepayCheckout(planId)).data;
      } catch (e) {
        const pending = pendingCheckoutFromError(e);
        if (pending) return pending;
        throw e;
      }
    },
    onSuccess: async (checkout) => {
      queryClient.setQueryData(sepayCheckoutKey(checkout.paymentId), checkout);
      await savePending(scope, checkout.paymentId);
    },
  });
}

// ─── Theo dõi một đơn ─────────────────────────────────────────────────────────

/** Poll trạng thái đơn khi còn PENDING; chốt thành công thì làm mới dữ liệu gói và xoá đơn đã lưu */
export function useSepayCheckout(paymentId: string | undefined, scope: PaymentScope) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: sepayCheckoutKey(paymentId),
    queryFn: async () => (await getSepayCheckout(paymentId!)).data,
    enabled: Boolean(paymentId),
    staleTime: 0,
    // Quay lại app (vd. từ app ngân hàng) → hỏi trạng thái ngay — cần hooks/shared/useAppStateFocus
    refetchOnWindowFocus: 'always',
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? SEPAY_POLL_INTERVAL_MS : false),
  });

  const confirmed = query.data ? isConfirmed(query.data) : false;
  useEffect(() => {
    if (!confirmed) return;
    clearPending(scope);
    invalidateAfterConfirmed(queryClient);
  }, [confirmed, scope.userId, scope.facilityId, queryClient]);

  return query;
}

export function useMockConfirmSepay(paymentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mockConfirmSepay(paymentId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sepayCheckoutKey(paymentId) }),
  });
}

// ─── Màn thanh toán ───────────────────────────────────────────────────────────

export type SepayPhase = 'loading' | 'error' | 'review' | 'success' | 'failed' | 'expired' | 'pending';

/**
 * Toàn bộ trạng thái + hành động của màn thanh toán (tương ứng SepayCheckoutModal của web).
 * View chỉ việc render theo `phase`.
 */
export function useSepayPaymentFlow(paymentId: string | undefined, scope: PaymentScope) {
  const query = useSepayCheckout(paymentId, scope);
  const startCheckout = useStartCheckout(scope);
  const mockConfirm = useMockConfirmSepay(paymentId);
  const checkout = query.data;
  const countdown = useCountdown(checkout?.expiresAt);
  const [savingQr, setSavingQr] = useState(false);

  let phase: SepayPhase;
  if (!checkout) phase = query.isError ? 'error' : 'loading';
  else if (requiresReview(checkout)) phase = 'review';
  else if (checkout.status === 'SUCCESS') phase = 'success';
  else if (checkout.status === 'FAILED' || checkout.status === 'REFUNDED') phase = 'failed';
  else if (countdown.expired) phase = 'expired';
  else phase = 'pending';

  /** Hỏi lại BE ngay; trả về true nếu đơn vẫn đang chờ */
  const checkAgain = async () => {
    const result = await query.refetch();
    return result.data?.status === 'PENDING';
  };

  /** Tạo đơn mới cho cùng gói (web: onCreateNew) */
  const createNew = (onCreated: (next: SepayCheckout) => void, onError: (e: unknown) => void) => {
    const planId = checkout?.plan?.id;
    if (!planId) return false;
    startCheckout.mutate(planId, { onSuccess: onCreated, onError });
    return true;
  };

  /** Sao chép một thông tin chuyển khoản (thay nút Copy của web) */
  const copy = (text: string) => copyToClipboard(text);

  /**
   * Lưu ảnh QR vào thư viện ảnh — trên cùng một điện thoại, người dùng mở app ngân hàng
   * → "Quét QR từ ảnh" để vẫn được điền đúng số tiền + nội dung.
   */
  const saveQr = async (): Promise<SaveImageResult> => {
    if (!checkout) return 'failed';
    setSavingQr(true);
    try {
      return await saveRemoteImageToLibrary(checkout.qrUrl, `${QR_IMAGE_FILE_PREFIX}-${checkout.orderCode}`);
    } finally {
      setSavingQr(false);
    }
  };

  return {
    phase,
    checkout,
    countdown,
    isFetching: query.isFetching,
    pollError: query.isError,
    loadError: query.error,
    reload: query.refetch,
    checkAgain,
    createNew,
    isCreatingNew: startCheckout.isPending,
    copy,
    saveQr,
    isSavingQr: savingQr,
    mockConfirm,
  };
}

// ─── Đơn gần nhất (thẻ "Xem trạng thái giao dịch" — web giữ đơn tới khi kích hoạt xong) ─

/**
 * Đơn SePay gần nhất của hội viên tại cơ sở hiện tại, đọc lại từ BE theo paymentId đã lưu.
 * Đơn đã kích hoạt xong hoặc không còn truy cập được (403/404) → tự xoá khỏi máy.
 */
export function usePendingPayment(scope: PaymentScope) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const { userId, facilityId } = scope;

  const load = useCallback(async () => {
    if (!userId) return;
    setPaymentId(await storage.getPendingPaymentId(userId, facilityId ?? ''));
  }, [userId, facilityId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const query = useQuery({
    queryKey: sepayCheckoutKey(paymentId ?? undefined),
    queryFn: async () => (await getSepayCheckout(paymentId!)).data,
    enabled: Boolean(paymentId),
    retry: (count, e) => !(e instanceof ApiError && [403, 404].includes(e.status)) && count < 1,
  });

  const checkout = query.data;
  const done = checkout ? isConfirmed(checkout) : false;
  const gone = query.error instanceof ApiError && [403, 404].includes(query.error.status);

  useEffect(() => {
    if (!paymentId || !(done || gone)) return;
    clearPending(scope);
    setPaymentId(null);
  }, [paymentId, done, gone, userId, facilityId]);

  return {
    pendingPayment: paymentId && checkout && !done ? checkout : null,
    refetchPending: async () => {
      await load();
      if (paymentId) await query.refetch();
    },
  };
}
