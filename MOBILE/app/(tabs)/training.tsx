import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type {
  Enrollment, TrainingPlan, Attendance, AttendanceStatus, ClassSchedule,
} from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── MEMBER: Training Plans screen ───────────────────────────────────────────

function MemberTrainingScreen({ memberId }: { memberId: string }) {
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');

  const { data: plansData, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['training-plans', memberId],
    queryFn: () => api.get<TrainingPlan[]>(`/training-plans?memberId=${memberId}`),
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['my-enrollments-completed'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { status: 'COMPLETED' }),
    enabled: activeTab === 'history',
  });

  const plans = plansData?.data ?? [];
  const history = historyData?.data ?? [];

  const onRefresh = () => {
    if (activeTab === 'plans') refetchPlans();
    else refetchHistory();
  };

  const isLoading = activeTab === 'plans' ? plansLoading : historyLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tập Luyện</Text>
        <Text style={styles.headerSub}>Theo dõi hành trình của bạn</Text>
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
              <Text style={styles.emptyText}>Huấn luyện viên sẽ tạo kế hoạch cho bạn</Text>
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
              <Text style={styles.emptyText}>Hoàn thành một buổi học để bắt đầu theo dõi</Text>
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

// ─── COACH: Attendance + Training Plans screen ────────────────────────────────

const ATTENDANCE_STATUS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Có mặt', color: Colors.status.completed },
  { value: 'ABSENT', label: 'Vắng', color: Colors.status.expired },
  { value: 'LATE', label: 'Trễ', color: Colors.status.suspended },
  { value: 'EXCUSED', label: 'Có phép', color: Colors.status.scheduled },
];

function CoachTrainingScreen({ coachId }: { coachId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedule' | 'attendance'>('schedule');
  const [selectedSchedule, setSelectedSchedule] = useState<ClassSchedule | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);

  // Coach's upcoming classes (booked enrollments of sessions they teach)
  const { data: enrollData, isLoading: enrollLoading, refetch: refetchEnroll } = useQuery({
    queryKey: ['coach-enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { status: 'BOOKED' }),
  });

  // Attendance for selected schedule
  const { data: attendanceData, isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', selectedSchedule?.id],
    queryFn: () => api.get<Attendance[]>(`/attendance?scheduleId=${selectedSchedule!.id}`),
    enabled: Boolean(selectedSchedule),
  });

  const { mutate: createAttendance, isPending: creating } = useMutation({
    mutationFn: (payload: { scheduleId: string; memberId: string; status: AttendanceStatus }) =>
      api.post('/attendance', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', selectedSchedule?.id] }),
  });

  const { mutate: updateAttendance, isPending: updating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      api.patch(`/attendance/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', selectedSchedule?.id] }),
  });

  const enrollments: Enrollment[] = enrollData?.data ?? [];
  const schedules: ClassSchedule[] = enrollments
    .filter((e: Enrollment) => Boolean(e.schedule))
    .map((e: Enrollment) => e.schedule!)
    // Deduplicate
    .filter((s: ClassSchedule, i: number, arr: ClassSchedule[]) => arr.findIndex((x: ClassSchedule) => x.id === s.id) === i);

  const attendances = attendanceData?.data ?? [];

  const handleMarkAttendance = (memberId: string, existingId?: string, existingStatus?: AttendanceStatus) => {
    setSelectedMemberId(memberId);
    setSelectedAttendanceId(existingId ?? null);
    setShowStatusModal(true);
  };

  const handleSelectStatus = (status: AttendanceStatus) => {
    if (!selectedSchedule) return;
    setShowStatusModal(false);
    if (selectedAttendanceId) {
      updateAttendance({ id: selectedAttendanceId, status });
    } else {
      createAttendance({ scheduleId: selectedSchedule.id, memberId: selectedMemberId, status });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quản Lý Dạy</Text>
        <Text style={styles.headerSub}>Điểm danh và theo dõi học viên</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'schedule' && styles.tabBtnActive]}
          onPress={() => { setActiveTab('schedule'); setSelectedSchedule(null); }}
        >
          <Text style={[styles.tabBtnText, activeTab === 'schedule' && styles.tabBtnTextActive]}>
            Lịch Dạy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'attendance' && styles.tabBtnActive]}
          onPress={() => setActiveTab('attendance')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'attendance' && styles.tabBtnTextActive]}>
            Điểm Danh
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab: Lịch Dạy */}
      {activeTab === 'schedule' && (
        enrollLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <FlatList
            data={schedules}
            keyExtractor={s => s.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetchEnroll} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialIcons name="event-busy" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
                <Text style={styles.emptyTitle}>Không có ca dạy</Text>
                <Text style={styles.emptyText}>Chưa có lịch dạy nào sắp tới</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.scheduleCard}>
                <View style={styles.scheduleLeft}>
                  <Text style={styles.scheduleTime}>{formatTime(item.startTime)}</Text>
                  <Text style={styles.scheduleTimeSub}>{formatTime(item.endTime)}</Text>
                </View>
                <View style={styles.scheduleRight}>
                  <Text style={styles.scheduleName}>{item.class?.name ?? 'Lớp học'}</Text>
                  {item.room && (
                    <View style={styles.iconRow}>
                      <MaterialIcons name="place" size={13} color={Colors.text.secondary} />
                      <Text style={styles.infoText}>{item.room.name}</Text>
                    </View>
                  )}
                  <View style={styles.iconRow}>
                    <MaterialIcons name="date-range" size={13} color={Colors.text.secondary} />
                    <Text style={styles.infoText}>{formatDate(item.startTime)}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        )
      )}

      {/* Tab: Điểm Danh */}
      {activeTab === 'attendance' && (
        <View style={{ flex: 1 }}>
          {/* Schedule picker */}
          {!selectedSchedule ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Chọn ca học để điểm danh:</Text>
              {enrollLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={schedules}
                  keyExtractor={s => s.id}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <MaterialIcons name="event-note" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
                      <Text style={styles.emptyTitle}>Không có ca học</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.selectScheduleCard} onPress={() => setSelectedSchedule(item)}>
                      <View>
                        <Text style={styles.scheduleName}>{item.class?.name ?? 'Lớp học'}</Text>
                        <Text style={styles.infoText}>{formatDate(item.startTime)} · {formatTime(item.startTime)}–{formatTime(item.endTime)}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          ) : (
            /* Attendance list for selected schedule */
            <View style={{ flex: 1 }}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedSchedule(null)}>
                <MaterialIcons name="arrow-back" size={20} color={Colors.primary} />
                <Text style={styles.backBtnText}>Chọn ca khác</Text>
              </TouchableOpacity>
              <View style={styles.selectedScheduleInfo}>
                <Text style={styles.scheduleName}>{selectedSchedule.class?.name}</Text>
                <Text style={styles.infoText}>{formatDate(selectedSchedule.startTime)} · {formatTime(selectedSchedule.startTime)}–{formatTime(selectedSchedule.endTime)}</Text>
              </View>
              {attendanceLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={attendances}
                  keyExtractor={a => a.id}
                  contentContainerStyle={styles.list}
                  refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAttendance} tintColor={Colors.primary} />}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <MaterialIcons name="group" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
                      <Text style={styles.emptyTitle}>Chưa có điểm danh</Text>
                      <Text style={styles.emptyText}>Danh sách học viên sẽ hiển thị khi có đăng ký</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const statusInfo = ATTENDANCE_STATUS.find(s => s.value === item.status);
                    return (
                      <TouchableOpacity
                        style={styles.attendanceCard}
                        onPress={() => handleMarkAttendance(item.memberId, item.id, item.status)}
                      >
                        <View style={styles.avatarCircle}>
                          <MaterialIcons name="person" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{item.member?.user.fullName ?? 'Học viên'}</Text>
                          <Text style={styles.memberEmail}>{item.member?.user.email}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: (statusInfo?.color ?? Colors.text.muted) + '25' }]}>
                          <Text style={[styles.statusBadgeText, { color: statusInfo?.color ?? Colors.text.muted }]}>
                            {statusInfo?.label ?? item.status}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* Status picker modal */}
      <Modal transparent visible={showStatusModal} animationType="slide" onRequestClose={() => setShowStatusModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cập nhật điểm danh</Text>
            {ATTENDANCE_STATUS.map(s => (
              <TouchableOpacity key={s.value} style={styles.modalOption} onPress={() => handleSelectStatus(s.value)}>
                <View style={[styles.colorDot, { backgroundColor: s.color }]} />
                <Text style={[styles.modalOptionText, { color: s.color }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowStatusModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Root component — role switch ─────────────────────────────────────────────

export default function TrainingScreen() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === 'COACH' && user.coachProfile?.id) {
    return <CoachTrainingScreen coachId={user.coachProfile.id} />;
  }

  const memberId = user.memberProfile?.id ?? '';
  return <MemberTrainingScreen memberId={memberId} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },

  // Header
  header: { padding: Spacing.xl, paddingBottom: Spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : Spacing.xl },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_600SemiBold', color: Colors.text.muted },
  tabBtnTextActive: { color: Colors.text.inverse },

  // List
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.sm, fontFamily: 'BeVietnamPro_700Bold' },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center', paddingHorizontal: Spacing.xl },

  // Plan card (MEMBER)
  planCard: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  planIconWrap: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  planName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  planDesc: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular', marginTop: 2 },
  resultSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  resultTitle: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_500Medium', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultDate: { fontSize: FontSize.sm, color: Colors.accent, fontFamily: 'BeVietnamPro_500Medium' },
  noteBox: { backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  noteLabel: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_500Medium', marginBottom: 4 },
  noteText: { fontSize: FontSize.sm, color: Colors.text.primary, fontFamily: 'BeVietnamPro_400Regular', fontStyle: 'italic' },

  // History card (MEMBER)
  historyCard: { flexDirection: 'row', marginBottom: Spacing.md },
  timelineLeft: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, zIndex: 1 },
  line: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  cardContent: { flex: 1 },
  cardDate: { fontSize: FontSize.xs, color: Colors.text.muted, marginBottom: Spacing.xs, fontFamily: 'BeVietnamPro_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBody: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  className: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: 6 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.completed + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  completedText: { fontSize: FontSize.xs, color: Colors.status.completed, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },

  // Schedule card (COACH)
  scheduleCard: {
    flexDirection: 'row', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, gap: Spacing.lg, alignItems: 'center',
  },
  scheduleLeft: { alignItems: 'center', minWidth: 48 },
  scheduleTime: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  scheduleTimeSub: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  scheduleRight: { flex: 1 },
  scheduleName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: 4 },

  // Attendance
  sectionLabel: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_500Medium', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  selectScheduleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  backBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  selectedScheduleInfo: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.md },
  attendanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  memberName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  memberEmail: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  statusBadgeText: { fontSize: FontSize.xs, fontFamily: 'BeVietnamPro_600SemiBold' },

  // Common
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.bg.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: 48 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.lg },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  modalOptionText: { fontSize: FontSize.md, fontFamily: 'BeVietnamPro_600SemiBold' },
  modalCancel: { paddingVertical: Spacing.lg, alignItems: 'center' },
  modalCancelText: { fontSize: FontSize.md, color: Colors.text.muted, fontFamily: 'BeVietnamPro_500Medium' },
});
