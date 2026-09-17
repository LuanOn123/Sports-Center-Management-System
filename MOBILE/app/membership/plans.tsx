import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import type { MembershipPlan, MembershipStatus, Subscription, MembershipTier } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const TIER_LABEL: Record<string, string> = { FREE: 'Miễn Phí', MEMBERSHIP: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };
const TIER_ICON: Record<string, React.ComponentProps<typeof MaterialIcons>['name']> = {
  FREE: 'star-border',
  MEMBERSHIP: 'star',
  PREMIUM: 'workspace-premium',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatPrice(price: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
}

export default function MembershipPlansScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const memberId = user?.memberProfile?.id ?? user?.id;
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['membership-status', memberId],
    queryFn: () => api.get<MembershipStatus>(`/members/${memberId}/membership-status`),
    enabled: Boolean(memberId),
  });

  const { data: plansData, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['membership-plans-active'],
    queryFn: () => api.publicGet<MembershipPlan[]>('/membership-plans', { isActive: 'true' }),
  });

  const { data: subsData, isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ['subscriptions', memberId],
    queryFn: () => api.get<Subscription[]>(`/subscriptions/member/${memberId}`),
    enabled: Boolean(memberId),
  });

  useFocusEffect(
    useCallback(() => {
      refetchStatus();
      refetchPlans();
      refetchSubs();
    }, [refetchStatus, refetchPlans, refetchSubs])
  );

  const isRefreshing = statusLoading || plansLoading || subsLoading;
  const onRefresh = async () => {
    await Promise.all([refetchStatus(), refetchPlans(), refetchSubs()]);
  };

  const subscribeMutation = useMutation({
    mutationFn: ({ planId, memberId: mId }: { planId: string; memberId: string }) =>
      api.post('/subscriptions', { memberId: mId, planId, paymentMethod: selectedMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-status'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showAlert('Đăng ký thành công', 'Gói thành viên của bạn đã được kích hoạt.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 403) {
        showAlert(
          'Đăng ký gói thành viên',
          'Vui lòng liên hệ quầy Lễ tân để kích hoạt gói thành viên của bạn.'
        );
      } else {
        showAlert('Lỗi', e instanceof ApiError ? e.message : 'Đăng ký thất bại. Vui lòng thử lại.');
      }
    },
  });

  const renewMutation = useMutation({
    mutationFn: ({ subId, planId }: { subId: string; planId: string }) =>
      api.post(`/subscriptions/${subId}/renew`, { planId, paymentMethod: selectedMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-status'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showAlert('Gia hạn thành công', 'Gói thành viên của bạn đã được gia hạn.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 403) {
        showAlert(
          'Gia hạn gói thành viên',
          'Vui lòng liên hệ quầy Lễ tân để thanh toán và gia hạn gói thành viên của bạn.'
        );
      } else {
        showAlert('Lỗi', e instanceof ApiError ? e.message : 'Gia hạn thất bại. Vui lòng thử lại.');
      }
    },
  });

  const plans = plansData?.data ?? [];
  const subs: Subscription[] = Array.isArray(subsData?.data) ? subsData.data : [];
  const activeSubFromList = subs.find(
    s => s.status === 'ACTIVE' && new Date(s.endDate).getTime() >= Date.now()
  );

  const rawStatus = statusData?.data;
  const activeSub = rawStatus?.activeSubscription ?? activeSubFromList ?? null;
  const effectiveTier: MembershipTier = (rawStatus?.effectiveTier && rawStatus.effectiveTier !== 'FREE')
    ? rawStatus.effectiveTier
    : (activeSub?.tier ?? activeSub?.plan?.tier ?? 'FREE');
  const daysRemaining = rawStatus?.daysRemaining !== undefined && rawStatus?.daysRemaining !== null
    ? rawStatus.daysRemaining
    : (activeSub ? Math.max(0, Math.ceil((new Date(activeSub.endDate).getTime() - Date.now()) / 86400000)) : null);

  const status: MembershipStatus = {
    effectiveTier,
    activeSubscription: activeSub,
    daysRemaining: daysRemaining ?? undefined,
  };

  const handleSubscribe = (plan: MembershipPlan) => {
    if (!memberId) return;
    showConfirm(
      `Đăng ký ${plan.name}`,
      `Giá: ${formatPrice(plan.price)}\nThời hạn: ${plan.durationDays} ngày\nThanh toán: ${selectedMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}`,
      () => subscribeMutation.mutate({ planId: plan.id, memberId }),
      undefined,
      'Xác nhận'
    );
  };

  const handleRenew = (plan: MembershipPlan) => {
    if (!activeSub) return;
    showConfirm(
      `Gia hạn ${plan.name}`,
      `Giá: ${formatPrice(plan.price)}\nThêm: ${plan.durationDays} ngày`,
      () => renewMutation.mutate({ subId: activeSub.id, planId: plan.id }),
      undefined,
      'Gia hạn'
    );
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Current status */}
      {statusLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <View style={[styles.currentCard, { borderColor: Colors.tier[status?.effectiveTier ?? 'FREE'] + '40' }]}>
          <Text style={styles.currentLabel}>Hạng hiện tại</Text>
          <View style={styles.currentRow}>
            <MaterialIcons
              name={TIER_ICON[status?.effectiveTier ?? 'FREE']}
              size={28}
              color={Colors.tier[status?.effectiveTier ?? 'FREE']}
            />
            <Text style={[styles.currentTier, { color: Colors.tier[status?.effectiveTier ?? 'FREE'] }]}>
              {TIER_LABEL[status?.effectiveTier ?? 'FREE']}
            </Text>
          </View>
          {Boolean(activeSub) ? (
            <View style={styles.infoCol}>
              <View style={styles.infoRow}>
                <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
                <Text style={styles.currentInfo}>Hết hạn: {formatDate(activeSub!.endDate)}</Text>
              </View>
              {Boolean(status?.daysRemaining !== undefined) && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="schedule" size={16} color={Colors.text.secondary} />
                  <Text style={styles.currentInfo}>Còn {status!.daysRemaining} ngày</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noActive}>Chưa có gói đang hiệu lực</Text>
          )}
        </View>
      )}

      {/* Payment method selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
        <View style={styles.methodRow}>
          {(['CASH', 'BANK_TRANSFER'] as const).map((m) => {
            const isActive = selectedMethod === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.methodBtn, isActive && styles.methodBtnActive]}
                onPress={() => setSelectedMethod(m)}
              >
                <MaterialIcons
                  name={m === 'CASH' ? 'payments' : 'account-balance'}
                  size={18}
                  color={isActive ? Colors.text.inverse : Colors.text.secondary}
                />
                <Text style={[styles.methodText, isActive && styles.methodTextActive]}>
                  {m === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Các gói thành viên</Text>
        {plansLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          plans.map((plan) => {
            const isCurrentPlan = activeSub?.planId === plan.id;
            return (
              <View key={plan.id} style={[styles.planCard, isCurrentPlan && styles.planCardActive]}>
                <View style={styles.planTop}>
                  <View style={styles.planTierRow}>
                    <MaterialIcons name={TIER_ICON[plan.tier]} size={20} color={Colors.tier[plan.tier]} />
                    <View style={[styles.planTierBadge, { backgroundColor: Colors.tier[plan.tier] + '20' }]}>
                      <Text style={[styles.planTierText, { color: Colors.tier[plan.tier] }]}>{TIER_LABEL[plan.tier]}</Text>
                    </View>
                    {Boolean(isCurrentPlan) && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Đang dùng</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {Boolean(plan.description) && <Text style={styles.planDesc}>{plan.description}</Text>}
                </View>
                <View style={styles.planMid}>
                  <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
                  <Text style={styles.planDuration}>{plan.durationDays} ngày</Text>
                </View>
                <View style={styles.planActions}>
                  {Boolean(activeSub) ? (
                    <TouchableOpacity
                      style={styles.renewBtn}
                      onPress={() => handleRenew(plan)}
                      disabled={renewMutation.isPending}
                    >
                      <MaterialIcons name="autorenew" size={18} color={Colors.accent} />
                      <Text style={styles.renewBtnText}>Gia hạn</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.subscribeBtn}
                      onPress={() => handleSubscribe(plan)}
                      disabled={subscribeMutation.isPending}
                    >
                      <Text style={styles.subscribeBtnText}>Đăng ký ngay</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch sử đăng ký</Text>
          {subs.slice(0, 5).map((s) => (
            <View key={s.id} style={styles.histItem}>
              <View>
                <Text style={styles.histPlan}>{s.plan?.name ?? 'Gói tập'}</Text>
                <Text style={styles.histDate}>{formatDate(s.startDate)} → {formatDate(s.endDate)}</Text>
              </View>
              <View style={[styles.histStatus, { backgroundColor: (Colors.status as Record<string, string>)[s.status.toLowerCase()] + '20' }]}>
                <Text style={[styles.histStatusText, { color: (Colors.status as Record<string, string>)[s.status.toLowerCase()] }]}>
                  {s.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  currentCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1 },
  currentLabel: { fontSize: FontSize.xs, color: Colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, fontFamily: 'BeVietnamPro_400Regular' },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  currentTier: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  infoCol: { gap: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentInfo: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  noActive: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.md },
  methodRow: { flexDirection: 'row', gap: Spacing.md },
  methodBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border,
  },
  methodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  methodTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  planCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  planCardActive: { borderColor: Colors.primary },
  planTop: { marginBottom: Spacing.lg },
  planTierRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  planTierBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  planTierText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  currentBadge: { backgroundColor: Colors.primary + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  currentBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  planName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: 4 },
  planDesc: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  planMid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.divider },
  planPrice: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  planDuration: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  planActions: {},
  subscribeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  subscribeBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_700Bold' },
  renewBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent + '20', borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  renewBtnText: { color: Colors.accent, fontWeight: FontWeight.bold, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_700Bold' },
  histItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  histPlan: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: 2 },
  histDate: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  histStatus: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  histStatusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});

