// components/coach/CoachAttendanceView.tsx
// Màn Điểm danh của HLV: chọn buổi → danh sách học viên → ghi điểm danh / tạo mã QR
// (logic ở hooks/coach/useCoachAttendance — theo luồng FE web)

import React from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { InfoBanner } from '../shared/InfoBanner';
import { AttendanceQrModal } from './AttendanceQrModal';
import { AttendanceStatusPicker } from './AttendanceStatusPicker';
import { useCoachAttendance } from '../../hooks/coach/useCoachAttendance';
import { useQrAttendance } from '../../hooks/coach/useQrAttendance';
import { Colors, Spacing } from '../../constants/theme';
import { ATTENDANCE_STATUS_COLOR, ATTENDANCE_STATUS_LABEL } from '../../constants/attendance';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import type { ClassSchedule, Enrollment } from '../../lib/types';

interface CoachAttendanceViewProps {
  coachId: string | undefined;
  /** Mở thẳng buổi này (điều hướng từ Lịch dạy / chi tiết buổi) */
  initialScheduleId?: string;
}

const LIST_PADDING = { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl };

const memberNameOf = (e: Enrollment) => e.member?.user?.fullName || `Học viên #${e.memberId.slice(-4)}`;
const sessionTimeOf = (s: ClassSchedule) =>
  `${formatWeekdayDate(s.startTime)} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}`;

function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <View className="items-center justify-center py-[60px]">
      <Icon name={icon} size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
      <Text className="text-md font-bevn-semibold text-text-secondary mb-1">{title}</Text>
      {Boolean(hint) && <Text className="text-xs text-text-muted font-bevn-regular text-center">{hint}</Text>}
    </View>
  );
}

export function CoachAttendanceView({ coachId, initialScheduleId }: CoachAttendanceViewProps) {
  const router = useRouter();
  const att = useCoachAttendance(coachId, initialScheduleId);
  const qr = useQrAttendance(att.selectedSchedule?.id);
  const selected = att.selectedSchedule;
  const markingEnrollment = att.roster.find((e) => e.memberId === att.markingMemberId);

  // Tab giữ nguyên params → xoá scheduleId khi quay lại danh sách, để lần sau mở lại
  // đúng buổi đó từ Lịch dạy thì param đổi giá trị và hook chọn lại buổi.
  const closeSession = () => {
    att.selectSchedule(null);
    router.setParams({ scheduleId: '' });
  };

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title="Điểm danh"
        subtitle={selected ? selected.class?.name ?? 'Buổi học' : 'Chọn buổi học để điểm danh'}
        onBackPress={att.hasSelection ? closeSession : undefined}
      />

      {!att.hasSelection ? (
        /* Danh sách buổi để chọn */
        att.schedulesLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <FlatList
            data={att.schedules}
            keyExtractor={(s) => s.id}
            contentContainerStyle={LIST_PADDING}
            refreshControl={<RefreshControl refreshing={false} onRefresh={att.onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={<EmptyState icon="event-note" title="Không có buổi học" hint="Chưa có buổi dạy nào gần đây hoặc sắp tới" />}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="bg-bg-surface rounded-lg p-lg flex-row justify-between items-center border border-border"
                onPress={() => att.selectSchedule(item.id)}
              >
                <View className="flex-1 mr-md">
                  <Text className="text-md font-bevn-semibold text-text-primary">{item.class?.name ?? 'Lớp học'}</Text>
                  <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">{sessionTimeOf(item)}</Text>
                </View>
                <Icon name="chevron-right" size={22} color={Colors.primary} />
              </TouchableOpacity>
            )}
          />
        )
      ) : !selected || att.rosterLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        /* Danh sách học viên của buổi đã chọn */
        <FlatList
          data={att.roster}
          keyExtractor={(e) => e.id}
          contentContainerStyle={LIST_PADDING}
          refreshControl={<RefreshControl refreshing={false} onRefresh={att.onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <View>
              <View className="flex-row items-center gap-md bg-bg-surface rounded-md p-md border border-border mb-md">
                <View className="flex-1">
                  <Text className="text-md font-bevn-bold text-text-primary">{selected.class?.name ?? 'Lớp học'}</Text>
                  <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{sessionTimeOf(selected)}</Text>
                </View>
                {att.canShowQr && (
                  <TouchableOpacity className="flex-row items-center gap-1 bg-primary rounded-md px-md py-sm" onPress={qr.open}>
                    <Icon name="qr-code-2" size={16} color={Colors.text.inverse} />
                    <Text className="text-text-inverse text-xs font-bevn-bold">Tạo mã QR</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!att.canWrite && (
                <InfoBanner
                  tone="info"
                  title="Chưa trong thời gian điểm danh"
                  message="Chỉ quản lý hoặc huấn luyện viên phụ trách được điểm danh khi buổi học đã bắt đầu (từ 30 phút trước giờ học tới khi kết thúc)."
                />
              )}
            </View>
          }
          ListEmptyComponent={<EmptyState icon="group-off" title="Chưa có học viên đăng ký" />}
          renderItem={({ item }) => {
            const record = att.recordFor(item.memberId);
            const color = record ? ATTENDANCE_STATUS_COLOR[record.status] : Colors.text.muted;
            const writable = !record && att.canWrite;
            const contact = item.member?.user?.phone || item.member?.user?.email;
            return (
              <View className="bg-bg-surface rounded-lg p-md flex-row items-center gap-md border border-border">
                <View className="w-[38px] h-[38px] rounded-full bg-bg-elevated items-center justify-center">
                  <Text className="text-sm font-bevn-bold text-primary">{memberNameOf(item).charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bevn-semibold text-text-primary">{memberNameOf(item)}</Text>
                  <Text className="text-xs text-text-muted mt-0.5 font-bevn-regular" numberOfLines={1}>
                    {record ? ATTENDANCE_STATUS_LABEL[record.status] : 'Chưa điểm danh'}
                    {contact ? ` • ${contact}` : ''}
                  </Text>
                </View>
                {record ? (
                  <View className="px-sm py-1 rounded-md border" style={{ backgroundColor: color + '20', borderColor: color }}>
                    <Text className="text-xs font-bevn-semibold" style={{ color }}>{ATTENDANCE_STATUS_LABEL[record.status]}</Text>
                  </View>
                ) : writable ? (
                  <TouchableOpacity
                    className="flex-row items-center gap-0.5 px-sm py-1 rounded-md border border-border bg-bg-elevated"
                    onPress={() => att.startMarking(item.memberId)}
                    disabled={att.isMarking}
                  >
                    <Text className="text-xs font-bevn-semibold text-text-secondary">Điểm danh</Text>
                    <Icon name="arrow-drop-down" size={16} color={Colors.text.secondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <AttendanceStatusPicker
        visible={Boolean(att.markingMemberId)}
        memberName={markingEnrollment ? memberNameOf(markingEnrollment) : undefined}
        onSelect={(status) =>
          att.mark(status, (e) => showAlert('Không lưu được điểm danh', e instanceof ApiError ? e.message : 'Vui lòng thử lại.'))
        }
        onClose={att.cancelMarking}
      />
      <AttendanceQrModal qr={qr} />
    </View>
  );
}
