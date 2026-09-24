// components/coach/CoachTrainingView.tsx
// UI Điểm danh & Quản lý lịch dạy dành riêng cho Huấn luyện viên (100% Real API)

import React from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import QRCode from 'react-native-qrcode-svg';
import { useCoachTraining } from '../../hooks/coach/useCoachTraining';
import { useQrAttendance } from '../../hooks/coach/useQrAttendance';
import { Colors } from '../../constants/theme';
import type { AttendanceStatus } from '../../lib/types';

const ATTENDANCE_STATUS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Có mặt', color: Colors.status.completed },
  { value: 'ABSENT', label: 'Vắng', color: Colors.status.expired },
  { value: 'LATE', label: 'Trễ', color: Colors.status.suspended },
  { value: 'EXCUSED', label: 'Có phép', color: Colors.status.scheduled },
];

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

  const qr = useQrAttendance(selectedSchedule?.id);

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className="px-xl pt-xl pb-md">
        <Text className="text-xxl font-bold font-bevn-bold text-text-primary">Quản Lý Giảng Dạy</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">Điểm danh học viên & theo dõi ca dạy</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-xl mb-md gap-sm">
        <TouchableOpacity
          className={clsx('flex-1 py-sm rounded-md items-center border', activeTab === 'schedule' ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
          onPress={() => { setActiveTab('schedule'); setSelectedSchedule(null); }}
        >
          <Text className={clsx('text-sm font-bevn-medium', activeTab === 'schedule' ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>
            Lịch Dạy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={clsx('flex-1 py-sm rounded-md items-center border', activeTab === 'attendance' ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
          onPress={() => setActiveTab('attendance')}
        >
          <Text className={clsx('text-sm font-bevn-medium', activeTab === 'attendance' ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>
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
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View className="items-center justify-center py-[60px]">
                <Icon name="event-busy" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
                <Text className="text-md font-semibold font-bevn-semibold text-text-secondary mb-1">Không có ca dạy</Text>
                <Text className="text-xs text-text-muted font-bevn-regular">Chưa có lịch dạy nào sắp tới</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="bg-bg-surface rounded-lg p-lg flex-row gap-lg border border-border">
                <View className="items-center justify-center border-r border-border pr-lg">
                  <Text className="text-md font-bold font-bevn-bold text-primary">{formatTime(item.startTime)}</Text>
                  <Text className="text-xs text-text-muted font-bevn-regular">{formatTime(item.endTime)}</Text>
                </View>
                <View className="flex-1 justify-center">
                  <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{item.class?.name ?? 'Lớp học'}</Text>
                  {item.room && (
                    <View className="flex-row items-center gap-1 mt-1">
                      <Icon name="place" size={13} color={Colors.text.secondary} />
                      <Text className="text-xs text-text-secondary font-bevn-regular">{item.room.name}</Text>
                    </View>
                  )}
                  <View className="flex-row items-center gap-1 mt-1">
                    <Icon name="date-range" size={13} color={Colors.text.secondary} />
                    <Text className="text-xs text-text-secondary font-bevn-regular">{formatDate(item.startTime)}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        )
      )}

      {/* Tab: Điểm Danh */}
      {activeTab === 'attendance' && (
        <View className="flex-1">
          {!selectedSchedule ? (
            <View className="flex-1">
              <Text className="text-sm font-semibold font-bevn-semibold text-text-secondary px-xl mt-xs">Chọn ca học để điểm danh:</Text>
              {isScheduleListLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={schedules}
                  keyExtractor={s => s.id}
                  contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
                  ListEmptyComponent={
                    <View className="items-center justify-center py-[60px]">
                      <Icon name="event-note" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
                      <Text className="text-md font-semibold font-bevn-semibold text-text-secondary mb-1">Không có ca học</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity className="bg-bg-surface rounded-lg p-lg flex-row justify-between items-center border border-border mb-sm" onPress={() => setSelectedSchedule(item)}>
                      <View>
                        <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{item.class?.name ?? 'Lớp học'}</Text>
                        <Text className="text-xs text-text-secondary font-bevn-regular">{formatDate(item.startTime)} · {formatTime(item.startTime)}–{formatTime(item.endTime)}</Text>
                      </View>
                      <Icon name="chevron-right" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          ) : (
            /* Attendance list for selected schedule */
            <View className="flex-1">
              <TouchableOpacity className="flex-row items-center gap-1.5 px-xl py-sm" onPress={() => setSelectedSchedule(null)}>
                <Icon name="arrow-back" size={20} color={Colors.primary} />
                <Text className="text-primary text-sm font-bevn-medium">Chọn ca khác</Text>
              </TouchableOpacity>

              <View className="flex-row items-center gap-md bg-bg-surface mx-xl rounded-md p-md border border-border mb-sm">
                <View className="flex-1">
                  <Text className="text-md font-bold font-bevn-bold text-text-primary">{selectedSchedule.class?.name ?? 'Lớp học'}</Text>
                  <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{formatDate(selectedSchedule.startTime)} · {formatTime(selectedSchedule.startTime)}–{formatTime(selectedSchedule.endTime)}</Text>
                </View>
                <TouchableOpacity className="flex-row items-center gap-1 bg-primary rounded-md px-md py-sm" onPress={qr.open}>
                  <Icon name="qr-code-2" size={16} color={Colors.text.inverse} />
                  <Text className="text-text-inverse text-xs font-bold font-bevn-bold">Tạo mã QR</Text>
                </TouchableOpacity>
              </View>

              {enrollmentsLoading || attendanceLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={enrollments}
                  keyExtractor={e => e.id}
                  contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
                  refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
                  ListEmptyComponent={
                    <View className="items-center justify-center py-[60px]">
                      <Icon name="group-off" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
                      <Text className="text-md font-semibold font-bevn-semibold text-text-secondary mb-1">Chưa có học viên đăng ký</Text>
                    </View>
                  }
                  renderItem={({ item: enrollment }) => {
                    const att = attendances.find(a => a.memberId === enrollment.memberId);
                    const attConfig = att ? ATTENDANCE_STATUS.find(s => s.value === att.status) : null;
                    const memberName = enrollment.member?.user?.fullName || `Học viên #${enrollment.memberId.slice(-4)}`;
                    const memberContact = enrollment.member?.user?.phone || enrollment.member?.user?.email;

                    return (
                      <View className="bg-bg-surface rounded-lg p-md flex-row items-center gap-md border border-border">
                        <View className="w-[38px] h-[38px] rounded-full bg-[#A3E63525] items-center justify-center">
                          <Text className="text-sm font-bold font-bevn-bold text-primary">
                            {memberName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold font-bevn-semibold text-text-primary">{memberName}</Text>
                          <Text className="text-xs text-text-muted mt-0.5 font-bevn-regular">
                            {att ? `Trạng thái: ${attConfig?.label}` : 'Chưa điểm danh'}
                            {memberContact ? ` • ${memberContact}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          className={clsx(
                            'flex-row items-center gap-0.5 px-sm py-1 rounded-md border',
                            !attConfig && 'bg-bg-elevated border-border'
                          )}
                          style={attConfig ? { backgroundColor: attConfig.color + '20', borderColor: attConfig.color } : undefined}
                          onPress={() => handleMarkAttendance(enrollment.memberId, att?.id, att?.status)}
                        >
                          <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: attConfig ? attConfig.color : Colors.text.muted }}>
                            {attConfig ? attConfig.label : 'Điểm danh'}
                          </Text>
                          <Icon name="arrow-drop-down" size={16} color={attConfig ? attConfig.color : Colors.text.muted} />
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
        <TouchableOpacity className="flex-1 bg-[#00000080] justify-center items-center p-xl" activeOpacity={1} onPress={() => setShowStatusModal(false)}>
          <View className="bg-bg-surface rounded-xl p-xl w-full max-w-[320px] border border-border">
            <Text className="text-md font-bold font-bevn-bold text-text-primary mb-lg">Chọn trạng thái điểm danh</Text>
            {ATTENDANCE_STATUS.map(s => (
              <TouchableOpacity
                key={s.value}
                className="flex-row items-center gap-md py-md px-md rounded-md mb-xs bg-bg-elevated border-l-4"
                style={{ borderLeftColor: s.color }}
                onPress={() => handleSelectStatus(s.value)}
              >
                <View className="w-2.5 h-2.5 rounded-[5px]" style={{ backgroundColor: s.color }} />
                <Text className="text-sm font-semibold font-bevn-semibold text-text-primary">{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal mã QR điểm danh */}
      <Modal visible={qr.visible} transparent animationType="fade" onRequestClose={qr.close}>
        <TouchableOpacity className="flex-1 bg-[#00000080] justify-center items-center p-xl" activeOpacity={1} onPress={qr.close}>
          <TouchableOpacity activeOpacity={1} className="bg-bg-surface rounded-xl p-xl w-full max-w-[320px] border border-border items-center">
            <Text className="text-md font-bold font-bevn-bold text-text-primary mb-lg">Mã QR điểm danh</Text>
            <Text className="text-xs text-text-muted text-center mb-lg font-bevn-regular">Hội viên quét mã này để điểm danh vào lớp</Text>
            <View className="w-[200px] h-[200px] items-center justify-center mb-md">
              {qr.token ? (
                <QRCode value={qr.token} size={200} />
              ) : (
                <ActivityIndicator color={Colors.primary} size="large" />
              )}
            </View>
            {Boolean(qr.error) && <Text className="text-sm text-status-expired text-center mb-md font-bevn-regular">{qr.error}</Text>}
            {Boolean(qr.manualCode) && (
              <View className="w-full items-center bg-bg-elevated rounded-lg p-lg mb-lg border border-border">
                <Text className="text-xs text-text-muted font-bevn-semibold tracking-wide">MÃ DỰ PHÒNG (không quét được QR)</Text>
                <Text className="text-xxl font-bold font-bevn-bold text-primary tracking-[6px] mt-1">{qr.manualCode}</Text>
                <Text className="text-xs text-text-secondary mt-1 font-bevn-medium">Hết hạn sau {qr.manualCodeSecondsLeft}s</Text>
              </View>
            )}
            <TouchableOpacity className="py-sm px-xl rounded-md bg-bg-elevated" onPress={qr.close}>
              <Text className="text-text-secondary text-sm font-bevn-medium">Đóng</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
