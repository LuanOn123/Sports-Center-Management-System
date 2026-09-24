import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Modal, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import {
  useMembershipData, usePendingRequest, useCancelSubscription, estimateSelfCancelRefund,
} from '../../hooks/member/useMembership';
import { showAlert, showConfirm } from '../../lib/alert';
import { storage } from '../../lib/storage';
import { ApiError } from '../../lib/api';
import type { MembershipPlan, PendingMembershipRequest } from '../../lib/types';
import { Colors } from '../../constants/theme';

const TIER_LABEL: Record<string, string> = { FREE: 'Miễn Phí', MEMBERSHIP: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };
const TIER_ICON: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  FREE: 'star-border',
  MEMBERSHIP: 'star',
  PREMIUM: 'workspace-premium',
};

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatPrice(price: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
}

export default function MembershipPlansScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const memberId = user?.memberProfile?.id ?? user?.id;
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // ─── Hooks (logic) ──────────────────────────────────────────────────────────
  const {
    activeSub, status, plans, subscriptions: subs,
    statusLoading, plansLoading,
    refetchStatus, refetchSubs, refetchPlans, onRefresh: refreshMembership,
  } = useMembershipData(memberId);

  const { pendingRequest, setPendingRequest, loadPending } = usePendingRequest(user?.id, activeSub);
  const cancelMutation = useCancelSubscription();

  useFocusEffect(
    useCallback(() => {
      refetchStatus();
      refetchPlans();
      refetchSubs();
      loadPending();
    }, [refetchStatus, refetchPlans, refetchSubs, loadPending])
  );

  const onRefresh = async () => {
    await refreshMembership();
    await loadPending();
  };

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // ─── Action handlers ────────────────────────────────────────────────────────
  const handleSubscribe = (plan: MembershipPlan) => {
    if (!user?.id) return;
    showConfirm(
      `Đăng ký ${plan.name}`,
      `Giá: ${formatPrice(plan.price)}\nThời hạn: ${plan.durationDays} ngày\nThanh toán: ${selectedMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}\n\nYêu cầu đăng ký sẽ được gửi tới quầy Lễ tân để xác nhận thanh toán và kích hoạt gói cho bạn.`,
      async () => {
        const req: PendingMembershipRequest = {
          planId: plan.id,
          planName: plan.name,
          tier: plan.tier,
          price: plan.price,
          durationDays: plan.durationDays,
          paymentMethod: selectedMethod,
          requestedAt: new Date().toISOString(),
        };
        await storage.setPendingPlan(user.id, req);
        setPendingRequest(req);
        showAlert(
          'Đã gửi yêu cầu đăng ký!',
          `Gói "${plan.name}" đang ở trạng thái CHỜ LỄ TÂN DUYỆT.\n\nVui lòng hoàn tất thanh toán tại quầy Lễ tân hoặc liên hệ nhân viên để được kích hoạt gói thành viên.`
        );
      },
      undefined,
      'Gửi yêu cầu'
    );
  };

  const handleRenew = (plan: MembershipPlan) => {
    if (!activeSub || !user?.id) return;
    showConfirm(
      `Gia hạn ${plan.name}`,
      `Giá: ${formatPrice(plan.price)}\nThêm: ${plan.durationDays} ngày\nThanh toán: ${selectedMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}\n\nYêu cầu gia hạn sẽ được quầy Lễ tân tiếp nhận và xử lý sau khi thanh toán.`,
      async () => {
        const req: PendingMembershipRequest = {
          planId: plan.id,
          planName: `Gia hạn ${plan.name}`,
          tier: plan.tier,
          price: plan.price,
          durationDays: plan.durationDays,
          paymentMethod: selectedMethod,
          requestedAt: new Date().toISOString(),
        };
        await storage.setPendingPlan(user.id, req);
        setPendingRequest(req);
        showAlert(
          'Đã gửi yêu cầu gia hạn!',
          `Yêu cầu gia hạn gói "${plan.name}" đang chờ duyệt.\n\nVui lòng thanh toán tại quầy Lễ tân để kích hoạt thêm ngày sử dụng.`
        );
      },
      undefined,
      'Gửi yêu cầu gia hạn'
    );
  };

  const openCancelModal = () => {
    if (!activeSub) return;
    cancelMutation.reset();
    setCancelReason('');
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    if (cancelMutation.isSuccess) refreshMembership();
  };

  const handleConfirmCancel = () => {
    if (!activeSub) return;
    cancelMutation.mutate({ id: activeSub.id, reason: cancelReason.trim() || undefined });
  };

  const handleCancelPending = () => {
    if (!user?.id) return;
    showConfirm(
      'Hủy yêu cầu đăng ký',
      'Bạn có chắc chắn muốn hủy yêu cầu đăng ký gói này để chọn gói khác?',
      async () => {
        await storage.clearPendingPlan(user.id);
        setPendingRequest(null);
        showAlert('Đã hủy', 'Bạn có thể chọn đăng ký gói thành viên khác.');
      },
      undefined,
      'Hủy yêu cầu'
    );
  };

  const cancelEstimate = activeSub ? estimateSelfCancelRefund(activeSub) : null;

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header with Back and Home buttons */}
      <View
        className={clsx(
          'flex-row justify-between items-center px-md pb-sm bg-bg-surface border-b border-border',
          Platform.OS === 'ios' ? 'pt-[52px]' : Platform.OS === 'android' ? 'pt-[42px]' : 'pt-[14px]'
        )}
      >
        <TouchableOpacity className="w-10 h-10 justify-center items-center rounded-full" onPress={handleGoBack}>
          <Icon name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold font-bevn-bold text-text-primary">Gói thành viên</Text>
        <TouchableOpacity className="w-10 h-10 justify-center items-center rounded-full" onPress={() => router.replace('/(tabs)')}>
          <Icon name="home" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Current status or Pending card */}
        {statusLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : activeSub ? (
          /* ACTIVE MEMBERSHIP CARD */
          <View className="bg-bg-surface rounded-xl p-xl mb-xl border" style={{ borderColor: Colors.tier[status.effectiveTier] + '60' }}>
            <View className="flex-row justify-between items-center mb-xs">
              <View className="flex-row items-center gap-1">
                <Icon
                  name={TIER_ICON[status.effectiveTier]}
                  size={14}
                  color={Colors.tier[status.effectiveTier]}
                />
                <Text className="text-xs font-bold font-bevn-bold tracking-wide" style={{ color: Colors.tier[status.effectiveTier] }}>
                  HẠNG {TIER_LABEL[status.effectiveTier].toUpperCase()}
                </Text>
              </View>
              <View className="px-sm py-0.5 rounded-full" style={{ backgroundColor: Colors.tier[status.effectiveTier] + '20' }}>
                <Text className="text-xs font-bold font-bevn-bold" style={{ color: Colors.tier[status.effectiveTier] }}>ĐANG SỬ DỤNG</Text>
              </View>
            </View>
            <Text className="text-xxl font-bold font-bevn-bold text-text-primary my-sm">
              {activeSub.plan?.name ?? `Gói ${TIER_LABEL[status.effectiveTier]}`}
            </Text>
            <View className="gap-1">
              <View className="flex-row items-center gap-1.5">
                <Icon name="event" size={16} color={Colors.text.secondary} />
                <Text className="text-sm text-text-secondary font-bevn-regular">Hết hạn: {formatDate(activeSub.endDate)}</Text>
              </View>
              {Boolean(status.daysRemaining !== undefined) && (
                <View className="flex-row items-center gap-1.5">
                  <Icon name="schedule" size={16} color={Colors.text.secondary} />
                  <Text className="text-sm text-text-secondary font-bevn-regular">Còn {status.daysRemaining} ngày sử dụng</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              className="flex-row justify-center items-center gap-1.5 mt-lg py-sm rounded-md border border-[#EF444440]"
              onPress={openCancelModal}
            >
              <Icon name="cancel" size={16} color={Colors.status.expired} />
              <Text className="text-status-expired font-semibold font-bevn-semibold text-sm">Hủy gói này</Text>
            </TouchableOpacity>
          </View>
        ) : pendingRequest ? (
          /* PENDING APPROVAL CARD */
          <View className="bg-bg-surface rounded-xl p-xl mb-xl border-[1.5px] border-[#F59E0B]">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs text-[#D97706] uppercase tracking-wide font-bevn-semibold">Yêu cầu đăng ký</Text>
              <View className="flex-row items-center gap-1 bg-[#F59E0B20] px-sm py-[3px] rounded-full">
                <Icon name="hourglass-top" size={12} color="#D97706" />
                <Text className="text-xs font-bold font-bevn-bold text-[#D97706]">CHỜ LỄ TÂN DUYỆT</Text>
              </View>
            </View>
            <Text className="text-xl font-bold font-bevn-bold text-text-primary mt-sm">{pendingRequest.planName}</Text>
            <Text className="text-lg font-bold font-bevn-bold text-[#D97706] my-1">
              {formatPrice(pendingRequest.price)} <Text className="text-sm text-text-muted font-bevn-regular">/ {pendingRequest.durationDays} ngày</Text>
            </Text>
            <View className="bg-[#F59E0B10] rounded-md p-md gap-1.5 my-md">
              <View className="flex-row items-center gap-1.5">
                <Icon name="payment" size={15} color={Colors.text.secondary} />
                <Text className="text-sm text-text-secondary font-bevn-medium">
                  Thanh toán: {pendingRequest.paymentMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản ngân hàng'}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Icon name="info-outline" size={15} color="#D97706" />
                <Text className="text-sm font-bevn-medium text-[#B45309]">
                  Vui lòng gặp Lễ tân để thanh toán & kích hoạt gói
                </Text>
              </View>
            </View>
            <View className="flex-row gap-md mt-xs">
              <TouchableOpacity className="flex-1 flex-row justify-center items-center gap-1.5 bg-[#A3E63515] rounded-md py-md border border-[#A3E63540]" onPress={onRefresh}>
                <Icon name="refresh" size={16} color={Colors.primary} />
                <Text className="text-primary font-bold font-bevn-bold text-sm">Kiểm tra kích hoạt</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-lg justify-center items-center rounded-md bg-bg-elevated" onPress={handleCancelPending}>
                <Text className="text-text-muted text-sm font-bevn-medium">Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* NO ACTIVE MEMBERSHIP */
          <View className="bg-bg-surface rounded-xl p-xl mb-xl border border-border">
            <Text className="text-xs text-text-muted uppercase tracking-wide mb-sm font-bevn-regular">Hạng hiện tại</Text>
            <View className="flex-row items-center gap-sm mb-md">
              <Icon name="star-border" size={28} color={Colors.text.muted} />
              <Text className="text-xxl font-bold font-bevn-bold text-text-muted">Miễn Phí (FREE)</Text>
            </View>
            <Text className="text-sm text-text-muted font-bevn-regular">Chưa có gói thành viên đang hiệu lực. Hãy chọn gói bên dưới để đăng ký!</Text>
          </View>
        )}

        {/* Payment method selector */}
        <View className="mb-xl">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md">Phương thức thanh toán</Text>
          <View className="flex-row gap-md">
            {(['CASH', 'BANK_TRANSFER'] as const).map((m) => {
              const isActive = selectedMethod === m;
              return (
                <TouchableOpacity
                  key={m}
                  className={clsx(
                    'flex-1 flex-row justify-center items-center gap-1.5 py-sm rounded-md border',
                    isActive ? 'bg-primary border-primary' : 'bg-bg-surface border-border'
                  )}
                  onPress={() => setSelectedMethod(m)}
                >
                  <Icon
                    name={m === 'CASH' ? 'payments' : 'account-balance'}
                    size={18}
                    color={isActive ? Colors.text.inverse : Colors.text.secondary}
                  />
                  <Text className={clsx('text-sm font-bevn-medium', isActive ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>
                    {m === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Plans */}
        <View className="mb-xl">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md">Các gói thành viên</Text>
          {plansLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            plans.map((plan) => {
              const isCurrentPlan = Boolean(
                activeSub && (
                  activeSub.planId === plan.id ||
                  activeSub.plan?.id === plan.id ||
                  (activeSub.plan?.name && activeSub.plan.name.trim().toLowerCase() === plan.name.trim().toLowerCase())
                )
              );
              const isPendingPlan = pendingRequest?.planId === plan.id;
              return (
                <View
                  key={plan.id}
                  className={clsx(
                    'bg-bg-surface rounded-xl p-xl mb-md border',
                    isCurrentPlan ? 'border-primary' : isPendingPlan ? 'border-[#F59E0B80]' : 'border-border'
                  )}
                >
                  <View className="mb-lg">
                    <View className="flex-row items-center gap-sm mb-sm">
                      <Icon name={TIER_ICON[plan.tier]} size={20} color={Colors.tier[plan.tier]} />
                      <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: Colors.tier[plan.tier] + '20' }}>
                        <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: Colors.tier[plan.tier] }}>{TIER_LABEL[plan.tier]}</Text>
                      </View>
                      {Boolean(isCurrentPlan) && (
                        <View className="bg-[#A3E63520] rounded-full px-sm py-0.5">
                          <Text className="text-xs text-primary font-semibold font-bevn-semibold">Đang sử dụng</Text>
                        </View>
                      )}
                      {Boolean(isPendingPlan && !isCurrentPlan) && (
                        <View className="bg-[#F59E0B20] rounded-full px-sm py-0.5">
                          <Text className="text-xs text-[#D97706] font-semibold font-bevn-semibold">Chờ duyệt</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-1">{plan.name}</Text>
                    {Boolean(plan.description) && <Text className="text-sm text-text-secondary font-bevn-regular">{plan.description}</Text>}
                  </View>
                  <View className="flex-row justify-between items-baseline mb-lg py-md border-t border-b border-divider">
                    <Text className="text-xl font-bold font-bevn-bold text-primary">{formatPrice(plan.price)}</Text>
                    <Text className="text-sm text-text-secondary font-bevn-regular">{plan.durationDays} ngày</Text>
                  </View>
                  <View>
                    {Boolean(isCurrentPlan) ? (
                      <TouchableOpacity className="flex-row justify-center items-center gap-1.5 bg-[#22C55E20] rounded-md p-md border border-[#22C55E40]" onPress={() => handleRenew(plan)}>
                        <Icon name="autorenew" size={18} color={Colors.accent} />
                        <Text className="text-accent font-bold font-bevn-bold text-md">Gia hạn gói này</Text>
                      </TouchableOpacity>
                    ) : activeSub ? (
                      <TouchableOpacity className="flex-row justify-center items-center gap-1.5 bg-[#A3E63515] rounded-md p-md border border-[#A3E63530]" onPress={() => handleSubscribe(plan)}>
                        <Icon name="swap-horiz" size={18} color={Colors.primary} />
                        <Text className="text-primary font-bold font-bevn-bold text-md">Đổi sang gói này</Text>
                      </TouchableOpacity>
                    ) : isPendingPlan ? (
                      <View className="flex-row justify-center items-center gap-1.5 bg-[#F59E0B15] rounded-md p-md border border-[#F59E0B40]">
                        <Icon name="hourglass-empty" size={16} color="#D97706" />
                        <Text className="text-[#D97706] font-bold font-bevn-bold text-sm">Đang chờ Lễ tân kích hoạt</Text>
                      </View>
                    ) : (
                      <TouchableOpacity className="bg-primary rounded-md p-md items-center" onPress={() => handleSubscribe(plan)}>
                        <Text className="text-text-inverse font-bold font-bevn-bold text-md">Đăng ký gói này</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* History */}
        {Boolean(subs.length > 0) && (
          <View className="mb-xl">
            <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md">Lịch sử đăng ký</Text>
            {subs.slice(0, 5).map((s) => (
              <View key={s.id} className="flex-row justify-between items-center py-md border-b border-divider">
                <View>
                  <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mb-0.5">{s.plan?.name ?? 'Gói tập'}</Text>
                  <Text className="text-xs text-text-muted font-bevn-regular">{formatDate(s.startDate)} → {formatDate(s.endDate)}</Text>
                </View>
                <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: (Colors.status as Record<string, string>)[s.status.toLowerCase()] + '20' }}>
                  <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: (Colors.status as Record<string, string>)[s.status.toLowerCase()] }}>
                    {s.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal xác nhận hủy gói — điều khoản hoàn tiền + lý do hủy (không bắt buộc) */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={closeCancelModal}>
        <TouchableOpacity
          className="flex-1 bg-[rgba(0,0,0,0.75)] justify-center items-center p-xl"
          activeOpacity={1}
          onPress={cancelMutation.isPending ? undefined : closeCancelModal}
        >
          <TouchableOpacity activeOpacity={1} className="w-full max-w-[400px] bg-bg-surface rounded-xl p-xl border border-border">
            <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md text-center">
              {cancelMutation.isSuccess ? 'Đã hủy gói tập' : 'Xác nhận hủy gói tập'}
            </Text>

            {cancelMutation.isSuccess && cancelMutation.data ? (
              <View className="gap-sm mb-lg">
                <Text className="text-sm text-status-active font-bevn-medium">Gói tập và các lượt đặt lớp tương lai đã được hủy.</Text>
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  {cancelMutation.data.data.willRefund
                    ? `Số tiền hoàn: ${formatPrice(cancelMutation.data.data.refundAmount)}. Vui lòng liên hệ quầy để nhận tiền.`
                    : 'Không phát sinh hoàn tiền.'}
                </Text>
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  Còn {cancelMutation.data.data.daysLeft} ngày tại thời điểm hủy.
                </Text>
              </View>
            ) : activeSub && cancelEstimate ? (
              <View className="gap-sm mb-lg">
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  Hủy <Text className="font-bold font-bevn-bold text-text-primary">{activeSub.plan?.name ?? 'gói tập'}</Text> sẽ chấm dứt quyền lợi và hủy toàn bộ lượt đặt lớp trong tương lai.
                </Text>
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  Còn trên 15 ngày: hoàn 30% khoản thanh toán gốc. Còn từ 15 ngày trở xuống: không hoàn tiền.
                </Text>
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  Dự kiến còn {cancelEstimate.daysLeft} ngày · Hoàn khoảng <Text className="font-bold font-bevn-bold text-text-primary">{formatPrice(cancelEstimate.refundAmount)}</Text>.
                </Text>
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  Ước tính theo giá gói hiện tại. Số tiền chính thức được xác định theo khoản thanh toán gốc và thời điểm xác nhận.
                </Text>
                <View className="mt-sm">
                  <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Lý do hủy (không bắt buộc)</Text>
                  <TextInput
                    className="bg-bg-elevated rounded-md p-md text-text-primary text-sm border border-border font-bevn-regular min-h-[80px]"
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                    maxLength={500}
                    editable={!cancelMutation.isPending}
                    placeholder="Nhập lý do (nếu có)..."
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
              </View>
            ) : null}

            {cancelMutation.isError && (
              <Text className="text-xs text-status-failed mb-md font-bevn-regular">
                {cancelMutation.error instanceof ApiError ? cancelMutation.error.message : 'Hủy gói thất bại. Vui lòng thử lại.'}
              </Text>
            )}

            <View className="flex-row gap-md">
              <TouchableOpacity
                className="flex-1 py-sm rounded-md items-center bg-bg-elevated border border-border"
                onPress={closeCancelModal}
                disabled={cancelMutation.isPending}
              >
                <Text className="text-text-secondary font-semibold font-bevn-semibold text-sm">
                  {cancelMutation.isSuccess ? 'Đóng' : 'Giữ gói tập'}
                </Text>
              </TouchableOpacity>
              {!cancelMutation.isSuccess && (
                <TouchableOpacity
                  className="flex-1 py-sm rounded-md items-center bg-status-failed"
                  onPress={handleConfirmCancel}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-bold font-bevn-bold text-sm">Xác nhận hủy gói</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
