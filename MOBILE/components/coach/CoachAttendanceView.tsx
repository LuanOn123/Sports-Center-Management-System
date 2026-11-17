// components/coach/CoachAttendanceView.tsx
// Tab Điểm danh của HLV: danh sách buổi gần đây / sắp tới để chọn (logic ở hooks/coach/useCoachAttendanceList).
// Chọn một buổi mở danh sách học viên của buổi đó (CoachRosterView) như MỘT MÀN CON đẩy lên trên tabs — không đổi nội dung ngay trong tab —
// nên vuốt từ trái sang phải (hoặc nút quay lại) về lại danh sách này được.

import React from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { WorkflowState } from '../shared/WorkflowScreen';
import { AttendanceEmpty } from './AttendanceEmpty';
import { useCoachAttendanceList } from '../../hooks/coach/useCoachAttendanceList';
import { Colors, Spacing } from '../../constants/theme';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import { ROUTES } from '../../navigation/routes';
import type { ClassSchedule } from '../../lib/types';

const LIST_PADDING = { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl };

const sessionTimeOf = (s: ClassSchedule) =>
  `${formatWeekdayDate(s.startTime)} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}`;

export function CoachAttendanceView({ coachId }: { coachId: string | undefined }) {
  const router = useRouter();
  const list = useCoachAttendanceList(coachId);

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader variant="tab" title="Điểm danh" />

      {list.error ? (
        <View className="p-xl"><WorkflowState error={list.error} retry={() => { void list.refresh(); }} /></View>
      ) : list.isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={list.schedules}
          keyExtractor={(s) => s.id}
          contentContainerStyle={LIST_PADDING}
          refreshControl={<RefreshControl refreshing={false} onRefresh={list.refresh} tintColor={Colors.primary} />}
          ListEmptyComponent={<AttendanceEmpty icon="event-note" title="Không có buổi học" hint="Chưa có buổi dạy nào gần đây hoặc sắp tới" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-bg-surface rounded-lg p-lg flex-row justify-between items-center border border-border"
              onPress={() => router.push(ROUTES.coachAttendanceFor(item.id))}
            >
              <View className="flex-1 mr-md">
                <Text className="text-md font-bevn-semibold text-text-primary">{item.class?.name ?? 'Lớp học'}</Text>
                <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">{sessionTimeOf(item)}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
