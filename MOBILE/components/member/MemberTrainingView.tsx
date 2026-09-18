// components/member/MemberTrainingView.tsx
// UI Kế hoạch & Lịch sử tập dành riêng cho Hội viên (Member)

import React from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemberTraining } from '../../hooks/member/useMemberTraining';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface MemberTrainingViewProps {
  memberId: string | undefined;
}

export function MemberTrainingView({ memberId }: MemberTrainingViewProps) {
  const {
    activeTab,
    setActiveTab,
    plans,
    history,
    isLoading,
    onRefresh,
  } = useMemberTraining(memberId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tập Luyện</Text>
        <Text style={styles.headerSub}>Theo dõi kế hoạch & lịch sử rèn luyện</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'plans' && styles.tabBtnActive]}
          onPress={() => setActiveTab('plans')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'plans' && styles.tabBtnTextActive]}>
            Kế Hoạch
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
            Lịch Sử Tập
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : activeTab === 'plans' ? (
        <FlatList
          data={plans}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="assignment" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Chưa có kế hoạch tập</Text>
              <Text style={styles.emptyText}>Huấn luyện viên sẽ tạo kế hoạch tập luyện phù hợp cho bạn</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planIconWrap}>
                  <MaterialIcons name="assignment" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.planDesc}>{item.description}</Text>
                  ) : null}
                </View>
              </View>
              {item.coach?.user && (
                <View style={styles.iconRow}>
                  <MaterialIcons name="person" size={14} color={Colors.text.secondary} />
                  <Text style={styles.infoText}>HLV: {item.coach.user.fullName}</Text>
                </View>
              )}
              <View style={styles.iconRow}>
                <MaterialIcons name="date-range" size={14} color={Colors.text.secondary} />
                <Text style={styles.infoText}>
                  {formatShortDate(item.startDate)} → {formatShortDate(item.endDate)}
                </Text>
              </View>
              {item.results && item.results.length > 0 && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultTitle}>Buổi tập gần nhất</Text>
                  <View style={styles.iconRow}>
                    <MaterialIcons name="event" size={13} color={Colors.accent} />
                    <Text style={styles.resultDate}>{formatShortDate(item.results[item.results.length - 1].date)}</Text>
                  </View>
                  {item.results[item.results.length - 1].coachNote ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteLabel}>Nhận xét HLV</Text>
                      <Text style={styles.noteText}>{item.results[item.results.length - 1].coachNote}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="insights" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Chưa có lịch sử</Text>
              <Text style={styles.emptyText}>Hoàn thành một buổi học để bắt đầu theo dõi tiến độ</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.timelineLeft}>
                <View style={styles.dot} />
                <View style={styles.line} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardDate}>{item.schedule ? formatDate(item.schedule.startTime) : '—'}</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.className}>{item.schedule?.class?.name ?? 'Lớp học'}</Text>
                  {Boolean(item.schedule) && (
                    <View style={styles.iconRow}>
                      <MaterialIcons name="schedule" size={14} color={Colors.text.secondary} />
                      <Text style={styles.infoText}>
                        {formatTime(item.schedule!.startTime)} – {formatTime(item.schedule!.endTime)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.completedBadge}>
                    <MaterialIcons name="check-circle" size={12} color={Colors.status.completed} />
                    <Text style={styles.completedText}>Hoàn thành</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md, gap: Spacing.sm },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  tabBtnTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  list: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: 4 },
  emptyText: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  infoText: { fontSize: FontSize.xs, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },

  planCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  planIconWrap: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  planDesc: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  resultSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  resultTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'BeVietnamPro_700Bold' },
  resultDate: { fontSize: FontSize.xs, color: Colors.text.primary, fontFamily: 'BeVietnamPro_500Medium' },
  noteBox: { backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.xs },
  noteLabel: { fontSize: 10, color: Colors.text.muted, fontFamily: 'BeVietnamPro_500Medium' },
  noteText: { fontSize: FontSize.xs, color: Colors.text.primary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },

  historyCard: { flexDirection: 'row', gap: Spacing.md },
  timelineLeft: { alignItems: 'center', width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.status.completed, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  cardContent: { flex: 1, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  cardDate: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', marginBottom: 4 },
  cardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  className: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold', flex: 1 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.status.completed + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  completedText: { fontSize: 10, color: Colors.status.completed, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});
