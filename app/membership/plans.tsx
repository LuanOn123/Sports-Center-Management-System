import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import type { MembershipPlan, MembershipStatus, Subscription } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const TIER_LABEL: Record<string, string> = { FREE: 'Miễn Phí', MEMBERSHIP: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };
const TIER_ICON: Record<string, string> = { FREE: '🆓', MEMBERSHIP: '⭐', PREMIUM: '💎' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatPrice(price: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
}

export default function MembershipPlansScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const memberId = user?.memberProfile?.id;
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['membership-status', memberId],
    queryFn: () => api.get<MembershipStatus>(`/members/${memberId}/membership-status`),
    enabled: Boolean(memberId),
  });

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['membership-plans-active'],
    queryFn: () => api.publicGet<MembershipPlan[]>('/membership-plans', { isActive: 'true' }),
  });

  const { data: subsData } = useQuery({
    queryKey: ['subscriptions', memberId],
    queryFn: () => api.get<Subscription[]>(`/subscriptions/member/${memberId}`),
    enabled: Boolean(memberId),
  });

  const subscribeMutation = useMutation({
    mutationFn: ({ planId, memberId: mId }: { planId: string; memberId: string }) =>
      api.post('/subscriptions', { memberId: mId, planId, paymentMethod: selectedMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-status'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      Alert.alert('✅ Đăng ký thành công!', 'Gói thành viên của bạn đã được kích hoạt.');
    },
    onError: (e) => {
      Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Đăng ký thất bại.');
    },
  });

  const renewMutation = useMutation({
    mutationFn: ({ subId, planId }: { subId: string; planId: string }) =>
      api.post(`/subscriptions/${subId}/renew`, { planId, paymentMethod: selectedMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-status'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      Alert.alert('✅ Gia hạn thành công!', 'Gói thành viên của bạn đã được gia hạn.');
    },
    onError: (e) => {
      Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Gia hạn thất bại.');
    },
  });

  const status = statusData?.data;
  const plans = plansData?.data ?? [];
  const subs = subsData?.data ?? [];
  const activeSub = status?.activeSubscription;

  const handleSubscribe = (plan: MembershipPlan) => {
    if (!memberId) return;
    Alert.alert(
      `Đăng ký ${plan.name}`,
      `Giá: ${formatPrice(plan.price)}\nThời hạn: ${plan.durationDays} ngày\nThanh toán: ${selectedMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', onPress: () => subscribeMutation.mutate({ planId: plan.id, memberId }) },
      ],
    );
  };

  const handleRenew = (plan: MembershipPlan) => {
    if (!activeSub) return;
    Alert.alert(
      `Gia hạn ${plan.name}`,
      `Giá: ${formatPrice(plan.price)}\nThêm: ${plan.durationDays} ngày`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Gia hạn', onPress: () => renewMutation.mutate({ subId: activeSub.id, planId: plan.id }) },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current status */}
      {statusLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <View style={[styles.currentCard, { borderColor: Colors.tier[status?.effectiveTier ?? 'FREE'] + '40' }]}>
          <Text style={styles.currentLabel}>Hạng hiện tại</Text>
          <View style={styles.currentRow}>
            <Text style={styles.currentTierIcon}>{TIER_ICON[status?.effectiveTier ?? 'FREE']}</Text>
            <Text style={[styles.currentTier, { color: Colors.tier[status?.effectiveTier ?? 'FREE'] }]}>
              {TIER_LABEL[status?.effectiveTier ?? 'FREE']}
            </Text>
          </View>
          {activeSub ? (
            <>
              <Text style={styles.currentInfo}>📅 Hết hạn: {formatDate(activeSub.endDate)}</Text>
              {status?.daysRemaining !== undefined && (
                <Text style={styles.currentInfo}>⏳ Còn {status.daysRemaining} ngày</Text>
              )}
            </>
          ) : (
            <Text style={styles.noActive}>Chưa có gói đang hiệu lực</Text>
          )}
        </View>
      )}

      {/* Payment method selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
        <View style={styles.methodRow}>
          {(['CASH', 'BANK_TRANSFER'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.methodBtn, selectedMethod === m && styles.methodBtnActive]}
              onPress={() => setSelectedMethod(m)}
            >
              <Text style={[styles.methodText, selectedMethod === m && styles.methodTextActive]}>
                {m === 'CASH' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
              </Text>
            </TouchableOpacity>
          ))}
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
                    <Text style={styles.planTierIcon}>{TIER_ICON[plan.tier]}</Text>
                    <View style={[styles.planTierBadge, { backgroundColor: Colors.tier[plan.tier] + '20' }]}>
                      <Text style={[styles.planTierText, { color: Colors.tier[plan.tier] }]}>{TIER_LABEL[plan.tier]}</Text>
                    </View>
                    {isCurrentPlan && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Đang dùng</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.description && <Text style={styles.planDesc}>{plan.description}</Text>}
                </View>
                <View style={styles.planMid}>
                  <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
                  <Text style={styles.planDuration}>{plan.durationDays} ngày</Text>
                </View>
                <View style={styles.planActions}>
                  {activeSub ? (
                    <TouchableOpacity
                      style={styles.renewBtn}
                      onPress={() => handleRenew(plan)}
                      disabled={renewMutation.isPending}
                    >
                      <Text style={styles.renewBtnText}>🔄 Gia hạn</Text>
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
      {subs.length > 0 && (
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
  currentTierIcon: { fontSize: 32 },
  currentTier: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  currentInfo: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular', marginBottom: 4 },
  noActive: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.md },
  methodRow: { flexDirection: 'row', gap: Spacing.md },
  methodBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border },
  methodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  methodTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  planCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  planCardActive: { borderColor: Colors.primary },
  planTop: { marginBottom: Spacing.lg },
  planTierRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  planTierIcon: { fontSize: 20 },
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
  renewBtn: { backgroundColor: Colors.accent + '20', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.accent + '40' },
  renewBtnText: { color: Colors.accent, fontWeight: FontWeight.bold, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_700Bold' },
  histItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  histPlan: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: 2 },
  histDate: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  histStatus: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  histStatusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});
