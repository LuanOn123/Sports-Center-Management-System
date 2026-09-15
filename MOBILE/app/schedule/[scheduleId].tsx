import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { ClassSchedule, Enrollment } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const STATUS_LABEL: Record<string, string> = { SCHEDULED: 'Đang mở', CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn thành' };
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: Colors.status.scheduled,
  CANCELLED: Colors.status.cancelled,
  COMPLETED: Colors.status.completed,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function ScheduleDetailScreen() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: schedData, isLoading } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => api.get<ClassSchedule>(`/class-schedules/${scheduleId}`),
    enabled: Boolean(scheduleId),
  });

  const bookMutation = useMutation({
    mutationFn: () => api.post('/enrollments', { scheduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      Alert.alert('✅ Đặt lịch thành công!', 'Lịch học đã được thêm vào danh sách của bạn.', [
        { text: 'OK', onPress: () => router.push('/(tabs)/schedule') },
      ]);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Đặt lịch thất bại.';
      Alert.alert('Lỗi', msg);
    },
  });

  const s = schedData?.data;
  const slotsUsed = s?._count?.enrollments ?? 0;
  const slotsLeft = s ? (s.class?.capacity ?? 0) - slotsUsed : 0;
  const isFull = slotsLeft <= 0;
  const isCancelled = s?.status === 'CANCELLED';

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }
  if (!s) {
    return <View style={styles.loading}><Text style={styles.errorText}>Không tìm thấy lịch học</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status banner */}
      <View style={[styles.statusBanner, { backgroundColor: STATUS_COLOR[s.status] + '15', borderColor: STATUS_COLOR[s.status] + '40' }]}>
        <Text style={[styles.statusText, { color: STATUS_COLOR[s.status] }]}>
          {STATUS_LABEL[s.status]}
        </Text>
      </View>

      {/* Main info */}
      <View style={styles.card}>
        <Text style={styles.className}>{s.class?.name ?? 'Lớp học'}</Text>
        {s.class?.sport && <Text style={styles.sportText}>🏅 {s.class.sport.name}</Text>}

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoLabel}>Ngày</Text>
            <Text style={styles.infoValue}>{formatDate(s.startTime)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>⏰</Text>
            <Text style={styles.infoLabel}>Thời gian</Text>
            <Text style={styles.infoValue}>{formatTime(s.startTime)} – {formatTime(s.endTime)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoLabel}>Phòng tập</Text>
            <Text style={styles.infoValue}>{s.room?.name ?? '—'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>👥</Text>
            <Text style={styles.infoLabel}>Chỗ còn lại</Text>
            <Text style={[styles.infoValue, isFull && { color: Colors.status.cancelled }]}>
              {isFull ? 'Hết chỗ' : `${slotsLeft} chỗ`}
            </Text>
          </View>
        </View>
      </View>

      {/* Room details */}
      {s.room && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông Tin Phòng</Text>
          <View style={styles.roomRow}>
            <Text style={styles.roomName}>{s.room.name}</Text>
          </View>
          {s.room.location && <Text style={styles.roomDetail}>📍 {s.room.location}</Text>}
          {s.room.capacity && <Text style={styles.roomDetail}>👥 Sức chứa: {s.room.capacity} người</Text>}
        </View>
      )}

      {/* Class details */}
      {s.class && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông Tin Lớp</Text>
          <TouchableOpacity onPress={() => router.push(`/classes/${s.class!.id}`)}>
            <Text style={styles.viewClassLink}>Xem chi tiết lớp học →</Text>
          </TouchableOpacity>
          {s.class.description && (
            <Text style={styles.classDesc}>{s.class.description}</Text>
          )}
        </View>
      )}

      {/* Book button */}
      {s.status === 'SCHEDULED' && (
        <TouchableOpacity
          style={[styles.bookBtn, (isFull || bookMutation.isPending) && styles.bookBtnDisabled]}
          onPress={() => {
            if (!isFull) {
              Alert.alert(
                'Xác nhận đặt lịch',
                `Đặt lớp "${s.class?.name}" lúc ${formatTime(s.startTime)} ngày ${formatDate(s.startTime)}?`,
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Đặt lịch', onPress: () => bookMutation.mutate() },
                ],
              );
            }
          }}
          disabled={isFull || bookMutation.isPending}
        >
          {bookMutation.isPending
            ? <ActivityIndicator color={Colors.text.inverse} />
            : <Text style={styles.bookBtnText}>{isFull ? 'Hết chỗ' : '📅 Đặt lịch học'}</Text>}
        </TouchableOpacity>
      )}
      {isCancelled && (
        <View style={styles.cancelledNote}>
          <Text style={styles.cancelledNoteText}>⚠️ Buổi học này đã bị hủy</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  loading: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.text.muted, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_400Regular' },
  statusBanner: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, alignItems: 'center' },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  card: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  className: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.xs },
  sportText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular', marginBottom: Spacing.xl },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  infoItem: { width: '47%', backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg, padding: Spacing.md },
  infoIcon: { fontSize: 20, marginBottom: 4 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold', marginTop: 2 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.md },
  roomRow: { marginBottom: Spacing.sm },
  roomName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  roomDetail: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular', marginBottom: 4 },
  viewClassLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: Spacing.sm },
  classDesc: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular', lineHeight: 22 },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: Colors.bg.elevated },
  bookBtnText: { color: Colors.text.inverse, fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  cancelledNote: { backgroundColor: Colors.status.cancelled + '15', borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.status.cancelled + '30' },
  cancelledNoteText: { color: Colors.status.cancelled, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_500Medium' },
});
