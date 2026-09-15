import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type { Enrollment, MembershipStatus } from '../../lib/types';
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
  const memberId = user?.memberProfile?.id;

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['membership-status', memberId],
    queryFn: () => api.get<MembershipStatus>(`/members/${memberId}/membership-status`),
    enabled: Boolean(memberId),
  });

  const { data: enrollmentsData, isLoading: enrollLoading, refetch: refetchEnroll } = useQuery({
    queryKey: ['my-enrollments-upcoming'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { status: 'BOOKED' }),
  });

  const isRefreshing = statusLoading || enrollLoading;
  const status = statusData?.data;
  const upcoming = enrollmentsData?.data?.slice(0, 3) ?? [];

  const onRefresh = async () => {
    await Promise.all([refetchStatus(), refetchEnroll()]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greeting}>Xin chào, {user?.fullName?.split(' ').pop()} 👋</Text>
          <Text style={styles.greetingSubtitle}>Hôm nay bạn tập gì?</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </TouchableOpacity>
      </View>

      {/* Membership Status Card */}
      <View style={[styles.membershipCard, { borderColor: Colors.tier[status?.effectiveTier ?? 'FREE'] + '40' }]}>
        <View style={styles.membershipTop}>
          <View>
            <Text style={styles.membershipLabel}>Hạng thành viên</Text>
            <Text style={[styles.membershipTier, { color: Colors.tier[status?.effectiveTier ?? 'FREE'] }]}>
              {statusLoading ? '—' : TIER_LABEL[status?.effectiveTier ?? 'FREE']}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.membershipBtn}
            onPress={() => router.push('/membership/plans')}
          >
            <Text style={styles.membershipBtnText}>Xem gói</Text>
          </TouchableOpacity>
        </View>
        {status?.activeSubscription && (
          <View style={styles.membershipInfo}>
            <Text style={styles.membershipInfoText}>
              📅 Hết hạn: {formatDate(status.activeSubscription.endDate)}
            </Text>
            {status.daysRemaining !== undefined && (
              <Text style={styles.membershipInfoText}>
                ⏳ Còn {status.daysRemaining} ngày
              </Text>
            )}
          </View>
        )}
        {!status?.activeSubscription && !statusLoading && (
          <Text style={styles.noMembership}>Chưa có gói thành viên đang hoạt động</Text>
        )}
      </View>

      {/* Training Level */}
      {user?.memberProfile?.trainingLevel && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statLabel}>Trình độ</Text>
            <Text style={styles.statValue}>{LEVEL_LABEL[user.memberProfile.trainingLevel]}</Text>
          </View>
          {user.memberProfile.fitnessGoal && (
            <View style={[styles.statCard, { flex: 2 }]}>
              <Text style={styles.statIcon}>💪</Text>
              <Text style={styles.statLabel}>Mục tiêu</Text>
              <Text style={styles.statValue} numberOfLines={2}>{user.memberProfile.fitnessGoal}</Text>
            </View>
          )}
        </View>
      )}

      {/* Upcoming Classes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch sắp tới</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
            <Text style={styles.sectionLink}>Xem tất cả →</Text>
          </TouchableOpacity>
        </View>

        {enrollLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : upcoming.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📅</Text>
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
              onPress={() => e.scheduleId && router.push(`/schedule/${e.scheduleId}`)}
            >
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingClass}>{e.schedule?.class?.name ?? 'Lớp học'}</Text>
                <Text style={styles.upcomingTime}>
                  {e.schedule ? `${formatDate(e.schedule.startTime)} • ${formatTime(e.schedule.startTime)} – ${formatTime(e.schedule.endTime)}` : '—'}
                </Text>
                {e.schedule?.room && (
                  <Text style={styles.upcomingRoom}>📍 {e.schedule.room.name}</Text>
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
            { icon: '🏋️', label: 'Lớp học', route: '/(tabs)/classes' as const },
            { icon: '📊', label: 'Gói tập', route: '/membership/plans' as const },
            { icon: '📈', label: 'Lịch sử', route: '/(tabs)/training' as const },
            { icon: '👤', label: 'Hồ sơ', route: '/(tabs)/profile' as const },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickItem}
              onPress={() => router.push(item.route)}
            >
              <Text style={styles.quickIcon}>{item.icon}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI Shortcut (stub) */}
      <TouchableOpacity style={styles.aiCard}>
        <View style={styles.aiLeft}>
          <Text style={styles.aiIcon}>🤖</Text>
          <View>
            <Text style={styles.aiTitle}>AI Workout Assistant</Text>
            <Text style={styles.aiSubtitle}>Hỏi AI về bài tập phù hợp</Text>
          </View>
        </View>
        <Text style={styles.aiArrow}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
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
  membershipTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  membershipLabel: { fontSize: FontSize.xs, color: Colors.text.muted, marginBottom: 4, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 1 },
  membershipTier: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  membershipBtn: { backgroundColor: Colors.primary + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  membershipBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  membershipInfo: { gap: 4 },
  membershipInfoText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  noMembership: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  statIcon: { fontSize: 20, marginBottom: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, marginTop: 2, fontFamily: 'BeVietnamPro_600SemiBold' },

  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: 'BeVietnamPro_500Medium' },

  emptyCard: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.xxxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
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
  upcomingRoom: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, marginLeft: Spacing.sm },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  quickItem: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  quickIcon: { fontSize: 28, marginBottom: Spacing.sm },
  quickLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },

  aiCard: {
    backgroundColor: Colors.primary + '15', borderRadius: Radius.xl,
    padding: Spacing.xl, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '30',
  },
  aiLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  aiIcon: { fontSize: 32 },
  aiTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  aiSubtitle: { fontSize: FontSize.xs, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  aiArrow: { fontSize: FontSize.xl, color: Colors.primary },
});
