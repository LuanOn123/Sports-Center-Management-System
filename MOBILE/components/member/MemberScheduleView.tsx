// components/member/MemberScheduleView.tsx
// UI Quản lý lịch học dành riêng cho Hội viên (Member)

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMyEnrollments, useCancelEnrollment } from '../../hooks/member/useEnrollments';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const STATUS_FILTER = [
  { label: 'Sắp tới', value: 'BOOKED' },
  { label: 'Hoàn thành', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
];

const STATUS_COLOR: Record<string, string> = {
  BOOKED: Colors.status.booked,
  COMPLETED: Colors.status.completed,
  CANCELLED: Colors.status.cancelled,
};
const STATUS_LABEL: Record<string, string> = {
  BOOKED: 'Đã đặt',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function MemberScheduleView() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('BOOKED');

  const { data, isLoading, refetch } = useMyEnrollments(filter);
  const { handleCancel, isPending: cancelPending } = useCancelEnrollment();

  const enrollments = data?.data ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lớp học của tôi</Text>
        <Text style={styles.headerSub}>Quản lý lịch đăng ký lớp học</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {STATUS_FILTER.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterTabText, filter === f.value && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
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
              <MaterialIcons name="event-busy" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyText}>Không có lịch nào</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => item.scheduleId && router.push(`/schedule/${item.scheduleId}`)}
              activeOpacity={0.8}
            >
              {/* Date strip */}
              {Boolean(item.schedule) && (
                <View style={styles.dateStrip}>
                  <Text style={styles.dateText}>{formatDate(item.schedule!.startTime)}</Text>
                  <Text style={styles.timeText}>
                    {formatTime(item.schedule!.startTime)} – {formatTime(item.schedule!.endTime)}
                  </Text>
                </View>
              )}

              <View style={styles.cardBody}>
                <View style={styles.cardMain}>
                  <Text style={styles.className}>{item.schedule?.class?.name ?? 'Lớp học'}</Text>
                  {Boolean(item.schedule?.room) && (
                    <View style={styles.roomRow}>
                      <MaterialIcons name="place" size={14} color={Colors.text.secondary} />
                      <Text style={styles.roomText}>{item.schedule!.room!.name}</Text>
                    </View>
                  )}
                  <Text style={styles.bookedAt}>Đặt lúc: {formatDateTime(item.bookedAt)}</Text>
                </View>

                <View style={styles.cardRight}>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                      {STATUS_LABEL[item.status]}
                    </Text>
                  </View>
                  {item.status === 'BOOKED' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(item.id)}
                      disabled={cancelPending}
                    >
                      <Text style={styles.cancelBtnText}>Hủy</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
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
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.md },
  filterTab: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  filterTabTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  list: { padding: Spacing.xl, gap: Spacing.md },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  card: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  dateStrip: {
    backgroundColor: Colors.bg.elevated, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  timeText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.lg },
  cardMain: { flex: 1, marginRight: Spacing.md },
  className: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: 4 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  roomText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  bookedAt: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  cardRight: { alignItems: 'flex-end', gap: Spacing.sm },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  cancelBtn: { backgroundColor: Colors.status.failed + '20', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  cancelBtnText: { fontSize: FontSize.xs, color: Colors.status.failed, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});
