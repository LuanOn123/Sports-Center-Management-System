// components/coach/CoachHomeView.tsx
// UI Trang chủ dành riêng cho Huấn luyện viên

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon as MaterialIcons } from '../shared/Icon';
import { Brand } from '../shared/Brand';
import { useCoachHome } from '../../hooks/coach/useCoachHome';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import type { User } from '../../lib/types';

const CLASS_TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Tiêu Chuẩn',
  PREMIUM: 'Cao Cấp',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

interface CoachHomeViewProps {
  user: User | null;
}

export function CoachHomeView({ user }: CoachHomeViewProps) {
  const router = useRouter();
  const coachId = user?.coachProfile?.id;

  const {
    coachClasses,
    teachingSchedules,
    isLoading,
    classesLoading,
    onRefresh,
  } = useCoachHome(coachId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Brand size="sm" align="flex-start" />
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase() ?? 'H'}</Text>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greetingSection}>
        <View style={styles.coachBadge}>
          <MaterialIcons name="sports" size={14} color={Colors.primary} />
          <Text style={styles.coachBadgeText}>HUẤN LUYỆN VIÊN</Text>
        </View>
        <Text style={styles.greeting}>Xin chào, HLV {user?.fullName}</Text>
        <Text style={styles.greetingSubtitle}>
          {user?.coachProfile?.specialization
            ? `Chuyên môn: ${user.coachProfile.specialization}`
            : 'Quản lý lịch dạy và các lớp học phụ trách'}
        </Text>
      </View>

      {/* Stats overview */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialIcons name="class" size={20} color={Colors.primary} style={styles.statIcon} />
          <Text style={styles.statLabel}>Lớp phụ trách</Text>
          <Text style={styles.statValue}>{coachClasses.length} lớp</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="event-available" size={20} color="#10B981" style={styles.statIcon} />
          <Text style={styles.statLabel}>Lịch dạy sắp tới</Text>
          <Text style={styles.statValue}>{teachingSchedules.length} buổi</Text>
        </View>
        {Boolean(user?.coachProfile?.experienceYears) && (
          <View style={styles.statCard}>
            <MaterialIcons name="workspace-premium" size={20} color="#F59E0B" style={styles.statIcon} />
            <Text style={styles.statLabel}>Kinh nghiệm</Text>
            <Text style={styles.statValue}>{user?.coachProfile?.experienceYears} năm</Text>
          </View>
        )}
      </View>

      {/* Lịch dạy sắp tới */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch dạy sắp tới</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/training')} style={styles.sectionLinkRow}>
            <Text style={styles.sectionLink}>Điểm danh</Text>
            <MaterialIcons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : teachingSchedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="event-available" size={44} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyText}>Chưa có lịch dạy sắp tới</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/classes')}>
              <Text style={styles.emptyBtnText}>Xem danh sách lớp</Text>
            </TouchableOpacity>
          </View>
        ) : (
          teachingSchedules.slice(0, 5).map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.coachScheduleCard}
              onPress={() => router.push(`/schedule/${s.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.scheduleHeaderRow}>
                <View style={styles.sportBadge}>
                  <Text style={styles.sportBadgeText}>{s.class?.sports?.map((sp) => sp.name).join(', ') || 'Môn thể thao'}</Text>
                </View>
                <View style={styles.timeTag}>
                  <MaterialIcons name="schedule" size={13} color={Colors.primary} />
                  <Text style={styles.timeTagText}>
                    {formatTime(s.startTime)} – {formatTime(s.endTime)}
                  </Text>
                </View>
              </View>

              <Text style={styles.coachClassTitle}>{s.class?.name ?? 'Lớp học'}</Text>

              <View style={styles.scheduleFooterRow}>
                <View style={styles.scheduleFooterItem}>
                  <MaterialIcons name="today" size={14} color={Colors.text.secondary} />
                  <Text style={styles.scheduleFooterText}>{formatDate(s.startTime)}</Text>
                </View>
                {Boolean(s.room) && (
                  <View style={styles.scheduleFooterItem}>
                    <MaterialIcons name="place" size={14} color={Colors.text.secondary} />
                    <Text style={styles.scheduleFooterText}>{s.room!.name}</Text>
                  </View>
                )}
                <View style={styles.scheduleFooterItem}>
                  <MaterialIcons name="people" size={14} color={Colors.primary} />
                  <Text style={[styles.scheduleFooterText, { color: Colors.primary, fontWeight: FontWeight.semibold }]}>
                    {s._count?.enrollments ?? 0}{s.class?.capacity ? `/${s.class.capacity}` : ''} học viên
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Lớp học phụ trách */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lớp học phụ trách</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/classes')} style={styles.sectionLinkRow}>
            <Text style={styles.sectionLink}>Tất cả lớp</Text>
            <MaterialIcons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {classesLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : coachClasses.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="school" size={44} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyText}>Chưa được phân công lớp học nào</Text>
          </View>
        ) : (
          coachClasses.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.coachClassCard}
              onPress={() => router.push(`/classes/${c.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.coachClassLeft}>
                <View style={styles.coachClassTop}>
                  <Text style={styles.coachClassName}>{c.name}</Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {CLASS_TYPE_LABEL[c.classType] ?? c.classType}
                    </Text>
                  </View>
                </View>
                {c.description ? (
                  <Text style={styles.coachClassDesc} numberOfLines={2}>{c.description}</Text>
                ) : null}
                <View style={styles.coachClassMetaRow}>
                  {Boolean(c.sports?.length) && (
                    <View style={styles.metaChip}>
                      <MaterialIcons name="fitness-center" size={12} color={Colors.text.secondary} />
                      <Text style={styles.metaChipText}>{c.sports!.map((s) => s.name).join(', ')}</Text>
                    </View>
                  )}
                  <View style={styles.metaChip}>
                    <MaterialIcons name="group" size={12} color={Colors.text.secondary} />
                    <Text style={styles.metaChipText}>Sức chứa: {c.capacity} học viên</Text>
                  </View>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.text.muted} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions for Coach */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'fitness-center' as const, label: 'Lớp học', route: '/(tabs)/classes' as const },
            { icon: 'how-to-reg' as const, label: 'Điểm danh', route: '/(tabs)/training' as const },
            { icon: 'chat' as const, label: 'Tin nhắn', route: '/(tabs)/chat' as const },
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

  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  coachBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    fontFamily: 'BeVietnamPro_700Bold',
    letterSpacing: 0.5,
  },

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

  // Coach Schedule card
  coachScheduleCard: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sportBadge: {
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  sportBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  coachClassTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    fontFamily: 'BeVietnamPro_700Bold',
    marginVertical: 4,
  },
  scheduleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  scheduleFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleFooterText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontFamily: 'BeVietnamPro_400Regular',
  },

  // Coach Class card
  coachClassCard: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coachClassLeft: { flex: 1, marginRight: Spacing.sm },
  coachClassTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  coachClassName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    fontFamily: 'BeVietnamPro_600SemiBold',
    flex: 1,
    marginRight: Spacing.sm,
  },
  typeBadge: {
    backgroundColor: Colors.bg.elevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBadgeText: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontFamily: 'BeVietnamPro_500Medium',
  },
  coachClassDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    fontFamily: 'BeVietnamPro_400Regular',
    marginBottom: Spacing.xs,
  },
  coachClassMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaChipText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontFamily: 'BeVietnamPro_400Regular',
  },

  // Quick grid
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
});
