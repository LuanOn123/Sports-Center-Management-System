// components/coach/CoachTrainingView.tsx
// UI Điểm danh & Quản lý lịch dạy dành riêng cho Huấn luyện viên (100% Real API)

import React from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCoachTraining } from '../../hooks/coach/useCoachTraining';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import type { AttendanceStatus } from '../../lib/types';

const ATTENDANCE_STATUS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Có mặt', color: Colors.status.completed },
  { value: 'ABSENT', label: 'Vắng', color: Colors.status.expired },
  { value: 'LATE', label: 'Trễ', color: Colors.status.suspended },
  { value: 'EXCUSED', label: 'Có phép', color: Colors.status.scheduled },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

interface CoachTrainingViewProps {
  coachId: string | undefined;
}

export function CoachTrainingView({ coachId }: CoachTrainingViewProps) {
  const {
    activeTab,
    setActiveTab,
    selectedSchedule,
    setSelectedSchedule,
    showStatusModal,
    setShowStatusModal,
    schedules,
    attendances,
    enrollments,
    isScheduleListLoading,
    enrollmentsLoading,
    attendanceLoading,
    handleMarkAttendance,
    handleSelectStatus,
    onRefresh,
  } = useCoachTraining(coachId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quản Lý Giảng Dạy</Text>
        <Text style={styles.headerSub}>Điểm danh học viên & theo dõi ca dạy</Text>
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
        isScheduleListLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <FlatList
            data={schedules}
            keyExtractor={s => s.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
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
          {!selectedSchedule ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Chọn ca học để điểm danh:</Text>
              {isScheduleListLoading ? (
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

              <View style={styles.currentScheduleBanner}>
                <Text style={styles.bannerTitle}>{selectedSchedule.class?.name ?? 'Lớp học'}</Text>
                <Text style={styles.bannerSub}>{formatDate(selectedSchedule.startTime)} · {formatTime(selectedSchedule.startTime)}–{formatTime(selectedSchedule.endTime)}</Text>
              </View>

              {enrollmentsLoading || attendanceLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={enrollments}
                  keyExtractor={e => e.id}
                  contentContainerStyle={styles.list}
                  refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <MaterialIcons name="group-off" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
                      <Text style={styles.emptyTitle}>Chưa có học viên đăng ký</Text>
                    </View>
                  }
                  renderItem={({ item: enrollment }) => {
                    const att = attendances.find(a => a.memberId === enrollment.memberId);
                    const attConfig = att ? ATTENDANCE_STATUS.find(s => s.value === att.status) : null;
                    const memberName = enrollment.member?.user?.fullName || `Học viên #${enrollment.memberId.slice(-4)}`;
                    const memberContact = enrollment.member?.user?.phone || enrollment.member?.user?.email;

                    return (
                      <View style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.avatarLetter}>
                            {memberName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{memberName}</Text>
                          <Text style={styles.memberSub}>
                            {att ? `Trạng thái: ${attConfig?.label}` : 'Chưa điểm danh'}
                            {memberContact ? ` • ${memberContact}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.statusBtn,
                            attConfig ? { backgroundColor: attConfig.color + '20', borderColor: attConfig.color } : styles.statusBtnUnmarked,
                          ]}
                          onPress={() => handleMarkAttendance(enrollment.memberId, att?.id, att?.status)}
                        >
                          <Text style={[styles.statusBtnText, attConfig ? { color: attConfig.color } : { color: Colors.text.muted }]}>
                            {attConfig ? attConfig.label : 'Điểm danh'}
                          </Text>
                          <MaterialIcons name="arrow-drop-down" size={16} color={attConfig ? attConfig.color : Colors.text.muted} />
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* Modal chọn trạng thái điểm danh */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn trạng thái điểm danh</Text>
            {ATTENDANCE_STATUS.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.modalOption, { borderLeftColor: s.color }]}
                onPress={() => handleSelectStatus(s.value)}
              >
                <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                <Text style={styles.modalOptionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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

  scheduleCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  scheduleLeft: { alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border, paddingRight: Spacing.lg },
  scheduleTime: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  scheduleTimeSub: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  scheduleRight: { flex: 1, justifyContent: 'center' },
  scheduleName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },

  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.secondary, paddingHorizontal: Spacing.xl, marginTop: Spacing.xs, fontFamily: 'BeVietnamPro_600SemiBold' },
  selectScheduleCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  backBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_500Medium' },
  currentScheduleBanner: { backgroundColor: Colors.bg.surface, marginHorizontal: Spacing.xl, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  bannerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  bannerSub: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },

  memberRow: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '25', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  memberName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  memberSub: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.md, borderWidth: 1 },
  statusBtnUnmarked: { backgroundColor: Colors.bg.elevated, borderColor: Colors.border },
  statusBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },

  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.lg, fontFamily: 'BeVietnamPro_700Bold' },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.xs, backgroundColor: Colors.bg.elevated, borderLeftWidth: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  modalOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
});
