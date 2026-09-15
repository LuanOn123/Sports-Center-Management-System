import React from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import type { Enrollment } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function TrainingScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-enrollments-completed'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { status: 'COMPLETED' }),
  });

  const enrollments = data?.data ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lịch Sử Tập Luyện</Text>
        <Text style={styles.headerSub}>Theo dõi hành trình của bạn</Text>
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{enrollments.length}</Text>
          <Text style={styles.statLabel}>Buổi đã tập</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {new Set(enrollments.map(e => e.schedule?.classId)).size}
          </Text>
          <Text style={styles.statLabel}>Lớp khác nhau</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {enrollments.filter(e => {
              const d = e.schedule ? new Date(e.schedule.startTime) : null;
              if (!d) return false;
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </Text>
          <Text style={styles.statLabel}>Tháng này</Text>
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={enrollments}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="insights" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Chưa có lịch sử</Text>
              <Text style={styles.emptyText}>Hoàn thành một buổi học để bắt đầu theo dõi</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Timeline dot */}
              <View style={styles.timelineLeft}>
                <View style={styles.dot} />
                <View style={styles.line} />
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardDate}>
                  {item.schedule ? formatDate(item.schedule.startTime) : '—'}
                </Text>
                <View style={styles.cardBody}>
                  <Text style={styles.className}>{item.schedule?.class?.name ?? 'Lớp học'}</Text>
                  {item.schedule && (
                    <View style={styles.iconRow}>
                      <MaterialIcons name="schedule" size={14} color={Colors.text.secondary} />
                      <Text style={styles.timeText}>
                        {formatTime(item.schedule.startTime)} – {formatTime(item.schedule.endTime)}
                      </Text>
                    </View>
                  )}
                  {item.schedule?.room && (
                    <View style={styles.iconRow}>
                      <MaterialIcons name="place" size={14} color={Colors.text.secondary} />
                      <Text style={styles.roomText}>{item.schedule.room.name}</Text>
                    </View>
                  )}
                  {item.schedule?.class?.sport && (
                    <View style={styles.iconRow}>
                      <MaterialIcons name="sports" size={14} color={Colors.text.secondary} />
                      <Text style={styles.sportText}>{item.schedule.class.sport.name}</Text>
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
  header: { padding: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  statLabel: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center' },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.sm, fontFamily: 'BeVietnamPro_700Bold' },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center' },
  card: { flexDirection: 'row', marginBottom: Spacing.md },
  timelineLeft: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, zIndex: 1 },
  line: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  cardContent: { flex: 1 },
  cardDate: { fontSize: FontSize.xs, color: Colors.text.muted, marginBottom: Spacing.xs, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBody: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  className: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: 6 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  timeText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  roomText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  sportText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.completed + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  completedText: { fontSize: FontSize.xs, color: Colors.status.completed, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});

