// components/coach/CoachAttendanceView.tsx
// Màn Điểm danh của HLV: chọn buổi → danh sách học viên (tìm theo tên/email) → ghi điểm danh / tạo mã QR / đánh giá tiến độ
// (logic ở hooks/coach/useCoachAttendance — theo luồng FE web)

import React from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { InfoBanner } from '../shared/InfoBanner';
import { AttendanceQrModal } from './AttendanceQrModal';
import { AttendanceStatusPicker } from './AttendanceStatusPicker';
import { EvaluationSheet } from './EvaluationSheet';
import { RosterRow, learnerNameOf } from './RosterRow';
import { useCoachAttendance } from '../../hooks/coach/useCoachAttendance';
import { useQrAttendance } from '../../hooks/coach/useQrAttendance';
import { Colors, Spacing } from '../../constants/theme';
import { GOAL_TEXT } from '../../constants/goals';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import type { ClassSchedule } from '../../lib/types';
import { WorkflowState } from '../shared/WorkflowScreen';
import { ROUTES } from '../../navigation/routes';

interface CoachAttendanceViewProps {
  coachId: string | undefined;
  /** Mở thẳng buổi này (điều hướng từ Lịch dạy / chi tiết buổi) */
  initialScheduleId?: string;
}

const LIST_PADDING = { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl };

/** Độ dài tối đa ô tìm học viên (web: maxLength 100) */
const SEARCH_MAX_LENGTH = 100;

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
  const evaluatingEnrollment = att.roster.find((e) => e.memberId === att.evaluate.memberId);

  // Tab giữ nguyên params → xoá scheduleId khi quay lại danh sách, để lần sau mở lại
  // đúng buổi đó từ Lịch dạy thì param đổi giá trị và hook chọn lại buổi.
  const closeSession = () => {
    att.selectSchedule(null);
    router.setParams({ scheduleId: '' });
  };

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Danh sách buổi: header tab; đang điểm danh một buổi: header có nút quay lại danh sách */}
      <ScreenHeader
        variant={att.hasSelection ? 'stack' : 'tab'}
        title="Điểm danh"
        onBackPress={att.hasSelection ? closeSession : undefined}
      />

      {att.error ? <View className="p-xl"><WorkflowState error={att.error} retry={() => { void att.onRefresh(); }} /></View> : !att.hasSelection ? (
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
              ? <EmptyState icon="search" title={GOAL_TEXT.searchNoResult} />
              : <EmptyState icon="group-off" title="Chưa có học viên đăng ký" />
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
        onSelect={(status) =>
          att.mark(status, (e) => showAlert('Không lưu được điểm danh', e instanceof ApiError ? e.message : 'Vui lòng thử lại.'))
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
