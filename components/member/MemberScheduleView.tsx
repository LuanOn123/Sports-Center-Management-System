

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon as MaterialIcons } from '../shared/Icon';
import { useMyEnrollments, useCancelEnrollment } from '../../hooks/member/useEnrollments';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import type { Enrollment } from '../../lib/types';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
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


function isSchedulePast(endTime?: string) {
  return Boolean(endTime) && new Date(endTime!) < new Date();
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date) {
  return isSameDay(d, new Date());
}

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const weekday = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
  return `${weekday}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatDayMonth(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function MemberScheduleView() {
  const router = useRouter();
  const [mode, setMode] = useState<'week' | 'list'>('week');
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // Mỗi lần quay lại tab này (kể cả sau khi chuyển sang tab khác rồi quay lại)
  // đều nhảy về đúng tuần/ngày hiện tại, không giữ lại tuần đã xem trước đó.
  useFocusEffect(
    useCallback(() => {
      setSelectedDay(new Date());
    }, [])
  );

  // Lấy toàn bộ enrollment (không lọc status ở BE) rồi tự chia thành 2 nhóm ở
  // client — vừa gom được cả buổi BOOKED-nhưng-đã-qua vào "Danh sách", vừa
  // tránh phải gọi nhiều request theo từng status.
  const { data, isLoading, refetch } = useMyEnrollments(undefined, '100');
  const { handleCancel, isPending: cancelPending } = useCancelEnrollment();

  const all: Enrollment[] = data?.data ?? [];

  const upcomingBooked = useMemo(
    () => all.filter((e) => e.status === 'BOOKED' && e.schedule),
    [all]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDay);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDay]);

  const historyItems = useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.status === 'CANCELLED' ||
            e.status === 'COMPLETED' ||
            (e.status === 'BOOKED' && isSchedulePast(e.schedule?.endTime))
        )
        .sort(
          (a, b) =>
            new Date(b.schedule?.startTime ?? b.bookedAt).getTime() -
            new Date(a.schedule?.startTime ?? a.bookedAt).getTime()
        ),
    [all]
  );

  const renderCard = (item: Enrollment, { showCancel }: { showCancel: boolean }) => {
    const past = item.status === 'BOOKED' && isSchedulePast(item.schedule?.endTime);
    const statusColor = past ? Colors.text.muted : STATUS_COLOR[item.status];
    const statusLabel = past ? 'Đã diễn ra' : STATUS_LABEL[item.status];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => item.scheduleId && router.push(`/schedule/${item.scheduleId}`)}
        activeOpacity={0.8}
      >
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
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {showCancel && item.status === 'BOOKED' && !past && (
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
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lịch tập cá nhân</Text>
        <Text style={styles.headerSub}>Thời khóa biểu các ca học đã đặt của bạn theo tuần</Text>
      </View>

      {/* Mode tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, mode === 'week' && styles.filterTabActive]}
          onPress={() => setMode('week')}
        >
          <Text style={[styles.filterTabText, mode === 'week' && styles.filterTabTextActive]}>Lịch tuần</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, mode === 'list' && styles.filterTabActive]}
          onPress={() => setMode('list')}
        >
          <Text style={[styles.filterTabText, mode === 'list' && styles.filterTabTextActive]}>Danh sách</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : mode === 'week' ? (
        <>
          {/* Khung tuần/tháng/thứ/ô ngày — cố định, không cuộn */}
          <View style={styles.calendarHeader}>
            <Text style={styles.weekRangeLabel}>
              Tuần hiện tại: {formatDayMonth(weekDays[0])} – {formatDayMonth(weekDays[6])}/{weekDays[6].getFullYear()}
            </Text>

            <View style={styles.monthNav}>
              <TouchableOpacity style={styles.monthNavBtn} onPress={() => setSelectedDay((d) => addDays(d, -7))}>
                <MaterialIcons name="arrow-back" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {MONTH_LABELS[weekDays[0].getMonth()]}, {weekDays[0].getFullYear()}
              </Text>
              <TouchableOpacity style={styles.monthNavBtn} onPress={() => setSelectedDay((d) => addDays(d, 7))}>
                <MaterialIcons name="arrow-forward" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayHeaderRow}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.weekdayHeaderText}>{label}</Text>
              ))}
            </View>

            {/* Hàng số ngày — chấm nhỏ báo ngày có lớp, khoanh tròn báo ngày đang chọn/hôm nay */}
            <View style={styles.dayBubbleRow}>
              {weekDays.map((d, i) => {
                const selected = isSameDay(d, selectedDay);
                const hasClass = upcomingBooked.some((e) => isSameDay(new Date(e.schedule!.startTime), d));
                return (
                  <TouchableOpacity key={d.toISOString()} style={styles.dayBubbleCol} onPress={() => setSelectedDay(d)}>
                    <View
                      style={[
                        styles.dayBubble,
                        isToday(d) && !selected && styles.dayBubbleToday,
                        selected && styles.dayBubbleSelected,
                      ]}
                    >
                      <Text style={[styles.dayBubbleText, selected && styles.dayBubbleTextSelected]}>{d.getDate()}</Text>
                    </View>
                    <View style={[styles.dayBubbleDot, hasClass && styles.dayBubbleDotVisible]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.agendaDivider} />
          </View>

          {/* Agenda theo tuần — chỉ khối này cuộn riêng, mỗi thứ 1 dòng */}
          <ScrollView
            contentContainerStyle={styles.weekScroll}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          >
            {weekDays.map((d, i) => {
              const selected = isSameDay(d, selectedDay);
              const dayClasses = upcomingBooked
                .filter((e) => isSameDay(new Date(e.schedule!.startTime), d))
                .sort((a, b) => new Date(a.schedule!.startTime).getTime() - new Date(b.schedule!.startTime).getTime());
              const hasClasses = dayClasses.length > 0;

              return (
                <View key={d.toISOString()} style={styles.agendaRow}>
                  <View style={styles.agendaDateCol}>
                    <Text style={[styles.agendaDateNum, selected && styles.agendaDateNumSelected]}>
                      {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                    </Text>
                    <Text style={styles.agendaWeekday}>{WEEKDAY_LABELS[i]}</Text>
                  </View>

                  {hasClasses && <View style={styles.agendaLine} />}

                  <View style={styles.agendaContent}>
                    {!hasClasses ? (
                      <Text style={styles.restDayText}>Nghỉ tập</Text>
                    ) : (
                      dayClasses.map((e) => {
                        const past = isSchedulePast(e.schedule?.endTime);
                        return (
                          <TouchableOpacity
                            key={e.id}
                            style={styles.dayChild}
                            activeOpacity={0.8}
                            onPress={() => e.scheduleId && router.push(`/schedule/${e.scheduleId}`)}
                          >
                            <View style={styles.dayChildBody}>
                              <Text style={styles.dayChildName} numberOfLines={1}>
                                {e.schedule?.class?.name ?? 'Lớp học'}
                              </Text>
                              <View style={styles.dayChildMetaRow}>
                                <MaterialIcons name="schedule" size={12} color={Colors.primaryDark} />
                                <Text style={styles.dayChildTime}>
                                  {formatTime(e.schedule!.startTime)} – {formatTime(e.schedule!.endTime)}
                                </Text>
                              </View>
                              {Boolean(e.schedule?.room) && (
                                <View style={styles.dayChildMetaRow}>
                                  <MaterialIcons name="place" size={12} color={Colors.primaryDark} />
                                  <Text style={styles.dayChildRoom}>{e.schedule!.room!.name}</Text>
                                </View>
                              )}
                            </View>
                            {past ? (
                              <Text style={styles.dayChildPastText}>Đã diễn ra</Text>
                            ) : (
                              <TouchableOpacity
                                style={styles.dayChildCancelBtn}
                                onPress={() => handleCancel(e.id)}
                                disabled={cancelPending}
                              >
                                <Text style={styles.dayChildCancelText}>Hủy</Text>
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="event-busy" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyText}>Chưa có buổi học đã qua hoặc đã hủy</Text>
            </View>
          }
          renderItem={({ item }) => renderCard(item, { showCancel: false })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.sm },
  filterTab: {
    flex: 1, paddingVertical: Spacing.xs, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  filterTabTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },

  calendarHeader: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  weekScroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },

  weekRangeLabel: {
    fontSize: FontSize.xs, color: Colors.text.muted, textAlign: 'center', fontFamily: 'BeVietnamPro_500Medium',
    backgroundColor: Colors.bg.surface, paddingVertical: 3, borderRadius: Radius.sm, marginBottom: Spacing.sm,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.sm,
  },
  monthNavBtn: { padding: Spacing.xs },
  monthLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },

  weekdayHeaderRow: { flexDirection: 'row', marginBottom: 2 },
  weekdayHeaderText: {
    flex: 1, textAlign: 'center', fontSize: FontSize.xs, color: Colors.text.muted,
    fontFamily: 'BeVietnamPro_600SemiBold', textTransform: 'uppercase',
  },

  dayBubbleRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  dayBubbleCol: { flex: 1, alignItems: 'center', gap: 2 },
  dayBubble: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  dayBubbleToday: { borderColor: Colors.primary },
  dayBubbleSelected: { backgroundColor: Colors.primary },
  dayBubbleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  dayBubbleTextSelected: { color: Colors.text.inverse, fontFamily: 'BeVietnamPro_700Bold' },
  dayBubbleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dayBubbleDotVisible: { backgroundColor: Colors.primary },

  agendaDivider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },

  agendaRow: { flexDirection: 'row', marginBottom: Spacing.md },
  agendaDateCol: { width: 56 },
  agendaDateNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  agendaDateNumSelected: { color: Colors.primary },
  agendaWeekday: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  agendaLine: { width: 2, backgroundColor: Colors.primary + '50', borderRadius: 1, marginRight: Spacing.md },
  agendaContent: { flex: 1, gap: Spacing.sm },

  restDayText: {
    fontSize: FontSize.sm, color: Colors.text.muted, marginTop: 2,
    fontFamily: 'BeVietnamPro_400Regular', fontStyle: 'italic',
  },
  dayChild: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.primary + '15', borderWidth: 1, borderColor: Colors.primary + '40',
  },
  dayChildBody: { flex: 1, gap: 2 },
  dayChildName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  dayChildMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayChildTime: { fontSize: FontSize.xs, color: Colors.primaryDark, fontFamily: 'BeVietnamPro_600SemiBold' },
  dayChildRoom: { fontSize: FontSize.xs, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  dayChildPastText: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  dayChildCancelBtn: { backgroundColor: Colors.status.failed + '20', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  dayChildCancelText: { fontSize: FontSize.xs, color: Colors.status.failed, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },

  list: { padding: Spacing.xl, paddingTop: 0, gap: Spacing.md },
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
