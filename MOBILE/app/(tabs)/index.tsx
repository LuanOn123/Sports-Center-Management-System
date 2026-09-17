import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { storage } from '../../lib/storage';
import type { Enrollment, MembershipStatus, Subscription, MembershipTier, PendingMembershipRequest } from '../../lib/types';
import { Brand } from '../../components/Brand';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';

const TIER_LABEL: Record<string, string> = {
  FREE: 'Miễn Phí',
  MEMBERSHIP: 'Tiêu Chuẩn',
  PREMIUM: 'Cao Cấp',
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const memberId = user?.memberProfile?.id ?? user?.id;
  const [pendingRequest, setPendingRequest] = useState<PendingMembershipRequest | null>(null);

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['membership-status', memberId],
    queryFn: () => api.get<MembershipStatus>(`/members/${memberId}/membership-status`),
    enabled: Boolean(memberId),
  });

  const { data: subsData, isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ['subscriptions', memberId],
    queryFn: () => api.get<Subscription[]>(`/subscriptions/member/${memberId}`),
    enabled: Boolean(memberId),
  });

  const { data: enrollmentsData, isLoading: enrollLoading, refetch: refetchEnroll } = useQuery({
    queryKey: ['my-enrollments-upcoming'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { status: 'BOOKED' }),
  });

  // Compute active membership status with fallback to subscriptions list
  const subscriptions: Subscription[] = Array.isArray(subsData?.data) ? subsData.data : [];
  const activeSubFromList = subscriptions.find(
    s => s.status === 'ACTIVE' && new Date(s.endDate).getTime() >= Date.now()
  );
  const rawStatus = statusData?.data;
  const activeSubscription = rawStatus?.activeSubscription ?? activeSubFromList ?? null;
  const effectiveTier: MembershipTier = (rawStatus?.effectiveTier && rawStatus.effectiveTier !== 'FREE')
    ? rawStatus.effectiveTier
    : (activeSubscription?.tier ?? activeSubscription?.plan?.tier ?? 'FREE');
  const daysRemaining = rawStatus?.daysRemaining !== undefined && rawStatus?.daysRemaining !== null
    ? rawStatus.daysRemaining
    : (activeSubscription ? Math.max(0, Math.ceil((new Date(activeSubscription.endDate).getTime() - Date.now()) / 86400000)) : null);

  const status: MembershipStatus = {
    effectiveTier,
    activeSubscription,
    daysRemaining: daysRemaining ?? undefined,
  };

  const loadPending = useCallback(async () => {
    if (!user?.id) return;
    if (activeSubscription) {
      await storage.clearPendingPlan(user.id);
      setPendingRequest(null);
    } else {
      const stored = await storage.getPendingPlan(user.id);
      setPendingRequest(stored);
    }
  }, [user?.id, activeSubscription]);

  // Auto-refresh when HomeScreen gains focus
  useFocusEffect(
    useCallback(() => {
      refetchStatus();
      refetchSubs();
      refetchEnroll();
      loadPending();
    }, [refetchStatus, refetchSubs, refetchEnroll, loadPending])
  );

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const isRefreshing = statusLoading || subsLoading || enrollLoading;
  const upcoming = enrollmentsData?.data?.slice(0, 3) ?? [];

  const onRefresh = async () => {
    await Promise.all([refetchStatus(), refetchSubs(), refetchEnroll()]);
    await loadPending();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Top Bar with Brand and Avatar */}
      <View style={styles.topBar}>
        <Brand size="sm" align="flex-start" />
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>Xin chào, {user?.fullName?.split(' ').pop()}</Text>
        <Text style={styles.greetingSubtitle}>Hôm nay bạn tập gì?</Text>
      </View>

      {/* Membership Status Card */}
      {Boolean(status.activeSubscription) ? (
        /* ACTIVE MEMBERSHIP */
        <View style={[styles.membershipCard, { borderColor: Colors.tier[status.effectiveTier] + '50' }]}>
          <View style={styles.membershipTop}>
            <View>
              <Text style={styles.membershipLabel}>Hạng thành viên</Text>
              <Text style={[styles.membershipTier, { color: Colors.tier[status.effectiveTier] }]}>
                {TIER_LABEL[status.effectiveTier]}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.membershipBtn}
              onPress={() => router.push('/membership/plans')}
            >
              <Text style={styles.membershipBtnText}>Gia hạn / Đổi gói</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.membershipInfo}>
            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
              <Text style={styles.membershipInfoText}>
                Hết hạn: {formatDate(status.activeSubscription!.endDate)}
              </Text>
            </View>
            {status.daysRemaining !== undefined && (
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={16} color={Colors.text.secondary} />
                <Text style={styles.membershipInfoText}>
                  Còn {status.daysRemaining} ngày
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : pendingRequest ? (
        /* PENDING MEMBERSHIP CARD */
        <View style={[styles.membershipCard, styles.membershipCardPending]}>
          <View style={styles.membershipTop}>
            <View>
              <View style={styles.pendingBadgeRow}>
                <MaterialIcons name="hourglass-top" size={14} color="#D97706" />
                <Text style={styles.pendingBadgeText}>CHỜ LỄ TÂN DUYỆT</Text>
              </View>
              <Text style={styles.pendingCardTitle}>{pendingRequest.planName}</Text>
            </View>
            <TouchableOpacity
              style={styles.pendingDetailBtn}
              onPress={() => router.push('/membership/plans')}
            >
              <Text style={styles.pendingDetailBtnText}>Chi tiết</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.membershipInfo}>
            <View style={styles.infoRow}>
              <MaterialIcons name="payment" size={15} color={Colors.text.secondary} />
              <Text style={styles.membershipInfoText}>
                Hình thức: {pendingRequest.paymentMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="info-outline" size={15} color="#D97706" />
              <Text style={[styles.membershipInfoText, { color: '#B45309' }]}>
                Vui lòng thanh toán tại quầy Lễ tân để kích hoạt
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* NO ACTIVE MEMBERSHIP */
        <View style={[styles.membershipCard, { borderColor: Colors.tier['FREE'] + '40' }]}>
          <View style={styles.membershipTop}>
            <View>
              <Text style={styles.membershipLabel}>Hạng thành viên</Text>
              <Text style={[styles.membershipTier, { color: Colors.tier['FREE'] }]}>
                {statusLoading ? '—' : 'Miễn Phí'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.membershipBtn}
              onPress={() => router.push('/membership/plans')}
            >
              <Text style={styles.membershipBtnText}>Xem gói</Text>
            </TouchableOpacity>
          </View>
          {!statusLoading && (
            <Text style={styles.noMembership}>Chưa có gói thành viên đang hoạt động</Text>
          )}
        </View>
      )}

      {/* Training Level */}
      {Boolean(user?.memberProfile?.trainingLevel) && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="track-changes" size={20} color={Colors.primary} style={styles.statIcon} />
            <Text style={styles.statLabel}>Trình độ</Text>
            <Text style={styles.statValue}>{LEVEL_LABEL[user!.memberProfile!.trainingLevel!]}</Text>
          </View>
          {Boolean(user?.memberProfile?.fitnessGoal) && (
            <View style={[styles.statCard, { flex: 2 }]}>
              <MaterialIcons name="fitness-center" size={20} color={Colors.primary} style={styles.statIcon} />
              <Text style={styles.statLabel}>Mục tiêu</Text>
              <Text style={styles.statValue} numberOfLines={2}>{user!.memberProfile!.fitnessGoal}</Text>
            </View>
          )}
        </View>
      )}

      {/* Upcoming Classes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch sắp tới</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')} style={styles.sectionLinkRow}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
            <MaterialIcons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {enrollLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : upcoming.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="event-busy" size={44} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyText}>Bạn chưa đăng ký lớp nào</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/classes')}>
              <Text style={styles.emptyBtnText}>Tìm lớp học</Text>
            </TouchableOpacity>
          </View>
        ) : (
          upcoming.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={styles.upcomingCard}
              onPress={() => {
                if (e.scheduleId) router.push(`/schedule/${e.scheduleId}`);
              }}
            >
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingClass}>{e.schedule?.class?.name ?? 'Lớp học'}</Text>
                <Text style={styles.upcomingTime}>
                  {e.schedule ? `${formatDate(e.schedule.startTime)} • ${formatTime(e.schedule.startTime)} – ${formatTime(e.schedule.endTime)}` : '—'}
                </Text>
                {Boolean(e.schedule?.room) && (
                  <View style={styles.roomRow}>
                    <MaterialIcons name="place" size={14} color={Colors.text.muted} />
                    <Text style={styles.upcomingRoom}>{e.schedule!.room!.name}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: Colors.status.booked + '20' }]}>
                <Text style={[styles.statusText, { color: Colors.status.booked }]}>Đã đặt</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>


      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'fitness-center' as const, label: 'Lớp học', route: '/(tabs)/classes' as const },
            { icon: 'card-membership' as const, label: 'Gói tập', route: '/membership/plans' as const },
            { icon: 'timeline' as const, label: 'Lịch sử', route: '/(tabs)/training' as const },
            { icon: 'person' as const, label: 'Hồ sơ', route: '/(tabs)/profile' as const },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickItem}
              onPress={() => router.push(item.route)}
            >
              <View style={styles.quickIconContainer}>
                <MaterialIcons name={item.icon} size={26} color={Colors.primary} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI Shortcut (stub) */}
      <TouchableOpacity style={styles.aiCard}>
        <View style={styles.aiLeft}>
          <View style={styles.aiIconWrapper}>
            <MaterialIcons name="auto-awesome" size={24} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.aiTitle}>AI Workout Assistant</Text>
            <Text style={styles.aiSubtitle}>Hỏi AI về bài tập phù hợp</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={Colors.primary} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greetingSection: { marginBottom: Spacing.xl },
  greeting: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  greetingSubtitle: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.inverse, fontFamily: 'BeVietnamPro_700Bold' },

  membershipCard: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.md,
  },
  membershipCardPending: {
    borderColor: '#F59E0B',
  },
  pendingBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4,
  },
  pendingBadgeText: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#D97706', fontFamily: 'BeVietnamPro_700Bold',
  },
  pendingCardTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold',
  },
  pendingDetailBtn: {
    backgroundColor: '#F59E0B20', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  pendingDetailBtnText: {
    color: '#D97706', fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold',
  },
  membershipTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  membershipLabel: { fontSize: FontSize.xs, color: Colors.text.muted, marginBottom: 4, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 1 },
  membershipTier: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  membershipBtn: { backgroundColor: Colors.primary + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  membershipBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  membershipInfo: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  membershipInfoText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  noMembership: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  statIcon: { marginBottom: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, marginTop: 2, fontFamily: 'BeVietnamPro_600SemiBold' },

  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  sectionLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: 'BeVietnamPro_500Medium' },

  emptyCard: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.xxxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: { color: Colors.text.muted, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_400Regular', marginBottom: Spacing.lg },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  emptyBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },

  upcomingCard: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.sm, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  upcomingLeft: { flex: 1 },
  upcomingClass: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  upcomingTime: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  upcomingRoom: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, marginLeft: Spacing.sm },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  quickItem: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  quickIconContainer: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },

  aiCard: {
    backgroundColor: Colors.primary + '15', borderRadius: Radius.xl,
    padding: Spacing.xl, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '30',
  },
  aiLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  aiIconWrapper: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center',
  },
  aiTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  aiSubtitle: { fontSize: FontSize.xs, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
});

