// components/coach/CoachRosterView.tsx
// Điểm danh MỘT buổi của HLV: danh sách học viên (tìm theo tên/email) → ghi điểm danh / tạo mã QR / đánh giá tiến độ
// (logic ở hooks/coach/useCoachAttendance — theo luồng FE web). Là màn con của khu vực coach, đẩy lên trên tabs: vuốt từ trái sang phải
// (hoặc nút quay lại) về đúng màn đã mở nó — Lịch dạy, Trang chủ, chi tiết buổi, chi tiết lớp hay danh sách buổi của tab Điểm danh.

import React from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { InfoBanner } from '../shared/InfoBanner';
import { WorkflowState } from '../shared/WorkflowScreen';
import { AttendanceEmpty } from './AttendanceEmpty';
import { AttendanceQrModal } from './AttendanceQrModal';
import { AttendanceStatusPicker } from './AttendanceStatusPicker';
import { EvaluationSheet } from './EvaluationSheet';
import { RosterRow, learnerNameOf } from './RosterRow';
import { useCoachAttendance } from '../../hooks/coach/useCoachAttendance';
import { useQrAttendance } from '../../hooks/coach/useQrAttendance';
import { Colors, Spacing } from '../../constants/theme';
import { COACH_ATTENDANCE_TEXT } from '../../constants/attendance';
import { GOAL_TEXT } from '../../constants/goals';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import type { ClassSchedule } from '../../lib/types';
import { ROUTES } from '../../navigation/routes';

interface CoachRosterViewProps {
  scheduleId: string | undefined;
}

const LIST_PADDING = { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl };

/** Độ dài tối đa ô tìm học viên (web: maxLength 100) */
const SEARCH_MAX_LENGTH = 100;

const sessionTimeOf = (s: ClassSchedule) =>
  `${formatWeekdayDate(s.startTime)} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}`;

export function CoachRosterView({ scheduleId }: CoachRosterViewProps) {
  const router = useRouter();
  const att = useCoachAttendance(scheduleId);
  const qr = useQrAttendance(scheduleId);
  const selected = att.selectedSchedule;
  const markingEnrollment = att.roster.find((e) => e.memberId === att.markingMemberId);
  const evaluatingEnrollment = att.roster.find((e) => e.memberId === att.evaluate.memberId);

  // Mở thẳng bằng đường dẫn (không có màn trước) thì về danh sách buổi của tab Điểm danh
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.coachAttendance);
  };

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader title="Điểm danh" onBackPress={goBack} />

      {att.error ? (
        <View className="p-xl"><WorkflowState error={att.error} retry={() => { void att.onRefresh(); }} /></View>
      ) : !selected || att.rosterLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        /* Danh sách học viên của buổi */
        <FlatList
          data={att.visibleRoster}
          keyExtractor={(e) => e.id}
          contentContainerStyle={LIST_PADDING}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={att.onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <View className="gap-md">
              <View className="flex-row items-center gap-md bg-bg-surface rounded-md p-md border border-border">
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
              {Boolean(att.evaluationsError) && (
                <InfoBanner tone="warning" title="Chưa có mục tiêu học viên" message={GOAL_TEXT.evaluateLoadFailed} />
              )}
              {att.roster.length > 0 && (
                <View className="gap-sm">
                  <View className="flex-row items-center gap-sm bg-bg-surface rounded-md px-md border border-border">
                    <Icon name="search" size={16} color={Colors.text.muted} />
                    <TextInput
                      accessibilityLabel={GOAL_TEXT.searchPlaceholder}
                      className="flex-1 py-md text-text-primary text-sm font-bevn-regular"
                      value={att.search}
                      onChangeText={att.setSearch}
                      maxLength={SEARCH_MAX_LENGTH}
                      placeholder={GOAL_TEXT.searchPlaceholder}
                      placeholderTextColor={Colors.text.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {att.search.length > 0 && (
                      <TouchableOpacity onPress={() => att.setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Xóa tìm kiếm">
                        <Icon name="close" size={16} color={Colors.text.muted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text className="text-xs text-text-muted font-bevn-regular">{GOAL_TEXT.rosterCount(att.visibleRoster.length, att.roster.length)}</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            att.roster.length
              ? <AttendanceEmpty icon="search" title={GOAL_TEXT.searchNoResult} />
              : <AttendanceEmpty icon="group-off" title="Chưa có học viên đăng ký" />
          }
          renderItem={({ item }) => {
            const record = att.recordFor(item.memberId);
            return (
              <RosterRow
                enrollment={item}
                record={record}
                writable={!record && att.canWrite}
                disabled={att.isMarking}
                evaluation={att.evaluationFor(item.memberId)}
                onMark={() => att.startMarking(item.memberId)}
                onEvaluate={() => att.evaluate.start(item.memberId)}
                onOpenProfile={() => router.push(ROUTES.coachMember(item.memberId, selected.id))}
              />
            );
          }}
        />
      )}

      <AttendanceStatusPicker
        visible={Boolean(att.markingMemberId)}
        memberName={markingEnrollment ? learnerNameOf(markingEnrollment) : undefined}
        onSelect={(status, note) =>
          att.mark(status, note, (e) => showAlert(COACH_ATTENDANCE_TEXT.saveFailed, e instanceof ApiError ? e.message : COACH_ATTENDANCE_TEXT.retry))
        }
        onClose={att.cancelMarking}
      />
      <EvaluationSheet
        visible={Boolean(att.evaluate.memberId)}
        learnerName={evaluatingEnrollment ? learnerNameOf(evaluatingEnrollment) : ''}
        item={att.evaluate.item}
        isPending={att.evaluate.isPending}
        error={att.evaluate.error}
        onSave={att.evaluate.save}
        onClose={att.evaluate.close}
      />
      <AttendanceQrModal qr={qr} />
    </View>
  );
}
