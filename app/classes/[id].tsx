import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon as MaterialIcons } from '../../components/shared/Icon';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { CoachRating } from '../../components/shared/CoachRating';
import type { Class, ClassSchedule, Enrollment, EnrollmentStatus } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const TYPE_LABEL: Record<string, string> = { REGULAR: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: classData, isLoading } = useQuery({
    queryKey: ['class', id],
    queryFn: () => api.get<Class>(`/classes/${id}`),
    enabled: Boolean(id),
  });

  const { data: schedulesData, isLoading: schedLoading } = useQuery({
    queryKey: ['class-schedules', id],
    queryFn: () => api.get<ClassSchedule[]>('/class-schedules', {
      classId: id,
      status: 'SCHEDULED',
      limit: '10',
    }),
    enabled: Boolean(id),
  });

  // Lấy danh sách enrollments của user để check trạng thái từng schedule (BOOKED, CANCELLED)
  const { data: enrollmentsData } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { limit: '100' }),
  });

  const bookMutation = useMutation({
    mutationFn: (scheduleId: string) => api.post('/enrollments', { scheduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      showAlert('Đặt lịch thành công', 'Lịch học đã được thêm vào danh sách của bạn.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Đặt lịch thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });

  const cls = classData?.data;
  const targetCoach = cls?.coaches?.find((c) => c.isPrimary) ?? cls?.coaches?.[0];
  const schedules = schedulesData?.data ?? [];
  // Map scheduleId -> status ('BOOKED' | 'CANCELLED' | 'COMPLETED')
  const userEnrollmentMap = new Map<string, EnrollmentStatus>();
  (enrollmentsData?.data ?? []).forEach((e) => {
    if (!userEnrollmentMap.has(e.scheduleId) || e.status === 'BOOKED') {
      userEnrollmentMap.set(e.scheduleId, e.status);
    }
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!cls) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Không tìm thấy lớp học</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Class Info */}
      <View style={styles.classCard}>
        <View style={styles.classTitleRow}>
          <Text style={styles.className}>{cls.name}</Text>
          <View style={[styles.typeBadge, cls.classType === 'PREMIUM' ? styles.typePremium : styles.typeRegular]}>
            <Text style={styles.typeBadgeText}>{TYPE_LABEL[cls.classType]}</Text>
          </View>
        </View>
        {Boolean(cls.sports?.length) && (
          <View style={styles.iconRow}>
            <MaterialIcons name="sports" size={16} color={Colors.primary} />
            <Text style={styles.classSport}>{cls.sports!.map((s) => s.name).join(', ')}</Text>
          </View>
        )}
        {Boolean(cls.description) && <Text style={styles.classDesc}>{cls.description}</Text>}
        <View style={styles.classStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{cls.capacity}</Text>
            <Text style={styles.statLbl}>Sĩ số tối đa</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{cls.coaches?.length ?? 0}</Text>
            <Text style={styles.statLbl}>Huấn luyện viên</Text>
          </View>
        </View>
      </View>

      {/* Coaches */}
      {Boolean(cls.coaches && cls.coaches.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Huấn Luyện Viên</Text>
          {cls.coaches!.map((c) => (
            <View key={c.coachId} style={styles.coachCard}>
              <View style={styles.coachAvatar}>
                <Text style={styles.coachAvatarText}>{c.coach?.user?.fullName?.charAt(0) ?? '?'}</Text>
              </View>
              <View style={styles.coachInfo}>
                <View style={styles.coachNameRow}>
                  <Text style={styles.coachName}>{c.coach?.user?.fullName ?? '—'}</Text>
                  {Boolean(c.isPrimary) && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryText}>Chính</Text>
                    </View>
                  )}
                </View>
                {Boolean(c.coach?.specialization) && (
                  <View style={styles.iconRow}>
                    <MaterialIcons name="star-outline" size={14} color={Colors.text.secondary} />
                    <Text style={styles.coachSpec}>{c.coach!.specialization}</Text>
                  </View>
                )}
                {Boolean(c.coach?.bio) && (
                  <Text style={styles.coachBio} numberOfLines={2}>{c.coach!.bio}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {Boolean(targetCoach) && (
        <CoachRating
          coachId={targetCoach!.coachId}
          coachName={targetCoach!.coach?.user?.fullName}
          classId={cls.id}
        />
      )}

      {/* Schedules */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lịch Học Sắp Tới</Text>
        {schedLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : schedules.length === 0 ? (
          <View style={styles.emptySchedule}>
            <MaterialIcons name="event-busy" size={36} color={Colors.text.muted} style={{ marginBottom: Spacing.sm }} />
            <Text style={styles.emptyScheduleText}>Chưa có lịch học sắp tới</Text>
          </View>
        ) : (
          schedules.map((s) => {
            const slotsUsed = s._count?.enrollments ?? 0;
            const slotsLeft = cls.capacity - slotsUsed;
            const isFull = slotsLeft <= 0;
            const isPast = new Date(s.startTime) < new Date();
            const userStatus = userEnrollmentMap.get(s.id);
            const isBooked = userStatus === 'BOOKED';
            // CANCELLED vẫn cho đặt lại — BE tự reactivate (BR-07)
            const isDisabled = isFull || isPast || isBooked || bookMutation.isPending;

            return (
              <View
                key={s.id}
                style={[
                  styles.scheduleCard,
                  isBooked && styles.scheduleCardBooked,
                ]}
              >
                <View style={styles.scheduleLeft}>
                  <Text style={styles.scheduleDate}>{formatDate(s.startTime)}</Text>
                  <Text style={styles.scheduleTime}>{formatTime(s.startTime)} – {formatTime(s.endTime)}</Text>
                  {Boolean(s.room) && (
                    <View style={styles.iconRow}>
                      <MaterialIcons name="place" size={14} color={Colors.text.secondary} />
                      <Text style={styles.scheduleRoom}>{s.room!.name}</Text>
                    </View>
                  )}
                  <View style={styles.iconRow}>
                    <MaterialIcons
                      name="group"
                      size={14}
                      color={isPast ? Colors.text.muted : isFull ? Colors.status.cancelled : Colors.status.active}
                    />
                    <Text style={[styles.scheduleSlots, (isFull || isPast) && styles.scheduleSlotsEmpty]}>
                      {isPast ? 'Đã qua giờ' : isFull ? 'Hết chỗ' : `Còn ${slotsLeft} chỗ`}
                    </Text>
                  </View>
                </View>

                {isBooked ? (
                  /* ĐÃ ĐẶT — hiển thị badge xanh thay vì nút */
                  <View style={styles.bookedBadge}>
                    <MaterialIcons name="check-circle" size={16} color={Colors.status.active} />
                    <Text style={styles.bookedBadgeText}>Đã đặt</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.bookBtn, (isFull || isPast) && styles.bookBtnDisabled]}
                    onPress={() => {
                      if (!isFull && !isPast) {
                        showConfirm(
                          'Xác nhận đặt lịch',
                          `Đặt lớp "${cls.name}" lúc ${formatTime(s.startTime)}?`,
                          () => bookMutation.mutate(s.id),
                          undefined,
                          'Đặt lịch'
                        );
                      }
                    }}
                    disabled={isDisabled}
                  >
                    {bookMutation.isPending
                      ? <ActivityIndicator color={Colors.text.inverse} size="small" />
                      : <Text style={[styles.bookBtnText, (isFull || isPast) && { color: Colors.text.muted }]}>
                          {isPast ? 'Đã diễn ra' : isFull ? 'Hết chỗ' : 'Đặt lịch'}
                        </Text>}
                  </TouchableOpacity>
                )}

              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  loading: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.text.muted, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_400Regular' },

  classCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  classTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  className: { flex: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginRight: Spacing.sm },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xs },
  classSport: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  classDesc: { fontSize: FontSize.sm, color: Colors.text.secondary, lineHeight: 22, marginBottom: Spacing.lg, fontFamily: 'BeVietnamPro_400Regular' },
  classStats: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.divider },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  statLbl: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.divider },
  typeBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  typeRegular: { backgroundColor: Colors.status.scheduled + '20' },
  typePremium: { backgroundColor: Colors.tier.PREMIUM + '20' },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_600SemiBold' },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.md },

  coachCard: { flexDirection: 'row', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  coachAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  coachAvatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  coachInfo: { flex: 1 },
  coachNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  coachName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  primaryBadge: { backgroundColor: Colors.primary + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  primaryText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  coachSpec: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  coachBio: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },

  emptySchedule: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyScheduleText: { color: Colors.text.muted, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_400Regular' },
  scheduleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  scheduleCardBooked: { borderColor: Colors.status.active + '60', backgroundColor: Colors.status.active + '08' },
  scheduleCardCancelled: { borderColor: Colors.status.cancelled + '40', backgroundColor: Colors.status.cancelled + '06', opacity: 0.85 },
  scheduleLeft: { flex: 1 },
  scheduleDate: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: 2 },
  scheduleTime: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: 2 },
  scheduleRoom: { fontSize: FontSize.xs, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  scheduleSlots: { fontSize: FontSize.xs, color: Colors.status.active, fontFamily: 'BeVietnamPro_500Medium' },
  scheduleSlotsEmpty: { color: Colors.status.cancelled },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, minWidth: 80, alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: Colors.bg.elevated },
  bookBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_700Bold' },
  bookedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.active + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.status.active + '40' },
  bookedBadgeText: { fontSize: FontSize.xs, color: Colors.status.active, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  cancelledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.cancelled + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.status.cancelled + '40' },
  cancelledBadgeText: { fontSize: FontSize.xs, color: Colors.status.cancelled, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
});

