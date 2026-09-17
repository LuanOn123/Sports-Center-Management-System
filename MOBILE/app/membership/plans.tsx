import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { storage } from '../../lib/storage';
import type { MembershipPlan, MembershipStatus, Subscription, MembershipTier, PendingMembershipRequest } from '../../lib/types';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const memberId = user?.memberProfile?.id ?? user?.id;
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [pendingRequest, setPendingRequest] = useState<PendingMembershipRequest | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

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

  // Sync pending request with storage and check if activated
  const loadPending = useCallback(async () => {
    if (!user?.id) return;
    if (activeSub) {
      // Activated by staff! Clear pending
      await storage.clearPendingPlan(user.id);
      setPendingRequest(null);
    } else {
      const stored = await storage.getPendingPlan(user.id);
      setPendingRequest(stored);
    }
  }, [user?.id, activeSub]);

  useFocusEffect(
    useCallback(() => {
      refetchStatus();
      refetchPlans();
      refetchSubs();
      loadPending();
    }, [refetchStatus, refetchPlans, refetchSubs, loadPending])
  );

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const isRefreshing = statusLoading || plansLoading || subsLoading;
  const onRefresh = async () => {
    await Promise.all([refetchStatus(), refetchPlans(), refetchSubs()]);
    await loadPending();
  };

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

  return (
    <View style={styles.screen}>
      {/* Header with Back and Home buttons */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBtn} onPress={handleGoBack}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Gói Thành Viên</Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)')}>
          <MaterialIcons name="home" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
      {/* Current status or Pending card */}
      {statusLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
      ) : activeSub ? (
        /* ACTIVE MEMBERSHIP CARD */
        <View style={[styles.currentCard, { borderColor: Colors.tier[status.effectiveTier] + '60' }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.tierBadgeRow}>
              <MaterialIcons
                name={TIER_ICON[status.effectiveTier]}
                size={14}
                color={Colors.tier[status.effectiveTier]}
              />
              <Text style={[styles.tierBadgeText, { color: Colors.tier[status.effectiveTier] }]}>
                HẠNG {TIER_LABEL[status.effectiveTier].toUpperCase()}
              </Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: Colors.tier[status.effectiveTier] + '20' }]}>
              <Text style={[styles.activeBadgeText, { color: Colors.tier[status.effectiveTier] }]}>ĐANG SỬ DỤNG</Text>
            </View>
          </View>
          <Text style={styles.currentPlanTitle}>
            {activeSub.plan?.name ?? `Gói ${TIER_LABEL[status.effectiveTier]}`}
          </Text>
          <View style={styles.infoCol}>
            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
              <Text style={styles.currentInfo}>Hết hạn: {formatDate(activeSub.endDate)}</Text>
            </View>
            {Boolean(status.daysRemaining !== undefined) && (
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={16} color={Colors.text.secondary} />
                <Text style={styles.currentInfo}>Còn {status.daysRemaining} ngày sử dụng</Text>
              </View>
            )}
          </View>
        </View>
      ) : pendingRequest ? (
        /* PENDING APPROVAL CARD */
        <View style={styles.pendingCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.pendingLabel}>Yêu cầu đăng ký</Text>
            <View style={styles.pendingBadge}>
              <MaterialIcons name="hourglass-top" size={12} color="#D97706" />
              <Text style={styles.pendingBadgeText}>CHỜ LỄ TÂN DUYỆT</Text>
            </View>
          </View>
          <Text style={styles.pendingPlanName}>{pendingRequest.planName}</Text>
          <Text style={styles.pendingPrice}>
            {formatPrice(pendingRequest.price)} <Text style={styles.pendingSubText}>/ {pendingRequest.durationDays} ngày</Text>
          </Text>
          <View style={styles.pendingInfoBox}>
            <View style={styles.infoRow}>
              <MaterialIcons name="payment" size={15} color={Colors.text.secondary} />
              <Text style={styles.pendingInfoText}>
                Thanh toán: {pendingRequest.paymentMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản ngân hàng'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="info-outline" size={15} color="#D97706" />
              <Text style={[styles.pendingInfoText, { color: '#B45309' }]}>
                Vui lòng gặp Lễ tân để thanh toán & kích hoạt gói
              </Text>
            </View>
          </View>
          <View style={styles.pendingActions}>
            <TouchableOpacity style={styles.checkBtn} onPress={onRefresh}>
              <MaterialIcons name="refresh" size={16} color={Colors.primary} />
              <Text style={styles.checkBtnText}>Kiểm tra kích hoạt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelPending}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* NO ACTIVE MEMBERSHIP */
        <View style={[styles.currentCard, { borderColor: Colors.border }]}>
          <Text style={styles.currentLabel}>Hạng hiện tại</Text>
          <View style={styles.currentRow}>
            <MaterialIcons name="star-border" size={28} color={Colors.text.muted} />
            <Text style={[styles.currentTier, { color: Colors.text.muted }]}>Miễn Phí (FREE)</Text>
          </View>
          <Text style={styles.noActive}>Chưa có gói thành viên đang hiệu lực. Hãy chọn gói bên dưới để đăng ký!</Text>
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
                  {m === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}
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
            const isCurrentPlan = Boolean(
              activeSub && (
                activeSub.planId === plan.id ||
                activeSub.plan?.id === plan.id ||
                (activeSub.plan?.name && activeSub.plan.name.trim().toLowerCase() === plan.name.trim().toLowerCase())
              )
            );
            const isPendingPlan = pendingRequest?.planId === plan.id;
            return (
              <View key={plan.id} style={[styles.planCard, isCurrentPlan && styles.planCardActive, isPendingPlan && styles.planCardPending]}>
                <View style={styles.planTop}>
                  <View style={styles.planTierRow}>
                    <MaterialIcons name={TIER_ICON[plan.tier]} size={20} color={Colors.tier[plan.tier]} />
                    <View style={[styles.planTierBadge, { backgroundColor: Colors.tier[plan.tier] + '20' }]}>
                      <Text style={[styles.planTierText, { color: Colors.tier[plan.tier] }]}>{TIER_LABEL[plan.tier]}</Text>
                    </View>
                    {Boolean(isCurrentPlan) && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Đang sử dụng</Text>
                      </View>
                    )}
                    {Boolean(isPendingPlan && !isCurrentPlan) && (
                      <View style={styles.pendingBadgeSmall}>
                        <Text style={styles.pendingBadgeSmallText}>Chờ duyệt</Text>
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
                  {Boolean(isCurrentPlan) ? (
                    <TouchableOpacity
                      style={styles.renewBtn}
                      onPress={() => handleRenew(plan)}
                    >
                      <MaterialIcons name="autorenew" size={18} color={Colors.accent} />
                      <Text style={styles.renewBtnText}>Gia hạn gói này</Text>
                    </TouchableOpacity>
                  ) : activeSub ? (
                    <TouchableOpacity
                      style={styles.switchBtn}
                      onPress={() => handleSubscribe(plan)}
                    >
                      <MaterialIcons name="swap-horiz" size={18} color={Colors.primary} />
                      <Text style={styles.switchBtnText}>Đổi sang gói này</Text>
                    </TouchableOpacity>
                  ) : isPendingPlan ? (
                    <View style={styles.pendingPlanBtn}>
                      <MaterialIcons name="hourglass-empty" size={16} color="#D97706" />
                      <Text style={styles.pendingPlanBtnText}>Đang chờ Lễ tân kích hoạt</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.subscribeBtn}
                      onPress={() => handleSubscribe(plan)}
                    >
                      <Text style={styles.subscribeBtnText}>Đăng ký gói này</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 52 : (Platform.OS === 'android' ? 42 : 14),
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  navTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    fontFamily: 'BeVietnamPro_700Bold',
  },
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
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  tierBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold', letterSpacing: 0.5 },
  currentPlanTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginVertical: Spacing.sm },
  activeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  switchBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '15', borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  switchBtnText: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_700Bold' },
  pendingCard: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl,
    marginBottom: Spacing.xl, borderWidth: 1.5, borderColor: '#F59E0B',
  },
  pendingLabel: { fontSize: FontSize.xs, color: '#D97706', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'BeVietnamPro_600SemiBold' },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B20', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full,
  },
  pendingBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#D97706', fontFamily: 'BeVietnamPro_700Bold' },
  pendingPlanName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginTop: Spacing.sm },
  pendingPrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#D97706', fontFamily: 'BeVietnamPro_700Bold', marginVertical: 4 },
  pendingSubText: { fontSize: FontSize.sm, color: Colors.text.muted, fontWeight: FontWeight.regular, fontFamily: 'BeVietnamPro_400Regular' },
  pendingInfoBox: {
    backgroundColor: '#F59E0B10', borderRadius: Radius.md, padding: Spacing.md, gap: 6, marginVertical: Spacing.md,
  },
  pendingInfoText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  pendingActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  checkBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '15', borderRadius: Radius.md, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  checkBtnText: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_700Bold' },
  cancelBtn: {
    paddingHorizontal: Spacing.lg, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.md, backgroundColor: Colors.bg.elevated,
  },
  cancelBtnText: { color: Colors.text.muted, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_500Medium' },
  planCardPending: { borderColor: '#F59E0B80' },
  pendingBadgeSmall: { backgroundColor: '#F59E0B20', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  pendingBadgeSmallText: { fontSize: FontSize.xs, color: '#D97706', fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  pendingPlanBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: '#F59E0B15', borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: '#F59E0B40',
  },
  pendingPlanBtnText: { color: '#D97706', fontWeight: FontWeight.bold, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_700Bold' },
  histItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  histPlan: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: 2 },
  histDate: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  histStatus: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  histStatusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});

