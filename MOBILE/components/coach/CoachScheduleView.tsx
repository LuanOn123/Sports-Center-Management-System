// components/coach/CoachScheduleView.tsx
// Màn Lịch dạy của HLV (web: CoachWorkspace mode "schedule") — logic ở hooks/coach/useCoachScheduleScreen

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { FilterChip } from '../shared/FilterChip';
import { CoachSessionCard } from './CoachSessionCard';
import { useCoachScheduleScreen, type ScheduleViewMode } from '../../hooks/coach/useCoachScheduleScreen';
import { Colors, Spacing } from '../../constants/theme';
import { SCHEDULE_STATUSES, SCHEDULE_STATUS_LABEL, WEEKDAY_LONG_FROM_MONDAY } from '../../constants/schedule';
import { ROUTES } from '../../navigation/routes';
import { ApiError } from '../../lib/api';
import { formatDayMonth } from '../../lib/format';
import { isToday } from '../../lib/date';

const VIEW_MODES: { value: ScheduleViewMode; label: string }[] = [
  { value: 'week', label: 'Theo tuần' },
  { value: 'list', label: 'Danh sách' },
];

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.xl }} className="mb-sm">
      {children}
    </ScrollView>
  );
}

export function CoachScheduleView({ coachId }: { coachId: string | undefined }) {
  const router = useRouter();
  const screen = useCoachScheduleScreen(coachId);
  const openSession = (id: string) => router.push(ROUTES.coachAttendanceFor(id));
  const weekLabel = `${formatDayMonth(screen.days[0])} – ${formatDayMonth(screen.days[6])}`;

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader title="Lịch dạy" subtitle="Sắp xếp tuần dạy và theo dõi học viên của từng buổi" />

      {/* Chuyển tuần */}
      <View className="flex-row items-center justify-between px-xl pt-xl mb-md">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-bg-surface border border-border items-center justify-center" onPress={screen.prevWeek} accessibilityLabel="Tuần trước">
          <Icon name="arrow-back" size={18} color={Colors.text.primary} />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-md font-bevn-bold text-text-primary">{weekLabel}</Text>
          {screen.isCurrentWeek ? (
            <Text className="text-xs text-primary font-bevn-medium mt-0.5">Tuần này</Text>
          ) : (
            <TouchableOpacity onPress={screen.thisWeek}>
              <Text className="text-xs text-text-secondary font-bevn-medium mt-0.5 underline">Về tuần này</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity className="w-10 h-10 rounded-full bg-bg-surface border border-border items-center justify-center" onPress={screen.nextWeek} accessibilityLabel="Tuần sau">
          <Icon name="arrow-forward" size={18} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Bộ lọc */}
      <ChipRow>
        <FilterChip label="Tất cả lớp của tôi" active={!screen.classFilter} onPress={() => screen.setClassFilter(null)} />
        {screen.classes.map((c) => (
          <FilterChip key={c.id} label={c.name} active={screen.classFilter === c.id} onPress={() => screen.setClassFilter(c.id)} />
        ))}
      </ChipRow>
      <ChipRow>
        <FilterChip label="Tất cả trạng thái" active={!screen.statusFilter} onPress={() => screen.setStatusFilter(null)} />
        {SCHEDULE_STATUSES.map((s) => (
          <FilterChip key={s} label={SCHEDULE_STATUS_LABEL[s]} active={screen.statusFilter === s} onPress={() => screen.setStatusFilter(s)} />
        ))}
        <View className="w-px bg-border mx-xs" />
        {VIEW_MODES.map((m) => (
          <FilterChip key={m.value} label={m.label} active={screen.mode === m.value} onPress={() => screen.setMode(m.value)} />
        ))}
      </ChipRow>

      {screen.isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={screen.refetch} tintColor={Colors.primary} />}
        >
          {screen.isError ? (
            <Text className="text-sm text-status-failed font-bevn-regular text-center mt-xl">
              {screen.error instanceof ApiError ? screen.error.message : 'Không tải được lịch dạy. Kéo xuống để thử lại.'}
            </Text>
          ) : screen.mode === 'list' ? (
            screen.sessions.length === 0 ? (
              <Text className="text-sm text-text-muted font-bevn-regular text-center mt-xl">Không có buổi dạy trong tuần hoặc bộ lọc này.</Text>
            ) : (
              screen.sessions.map((s) => <CoachSessionCard key={s.id} session={s} showDate onPress={() => openSession(s.id)} />)
            )
          ) : (
            screen.byDay.map(({ date, items }, i) => (
              <View key={date.toISOString()} className="mb-lg">
                <View className="flex-row items-baseline gap-sm mb-sm">
                  <Text className="text-md font-bevn-bold" style={{ color: isToday(date) ? Colors.primary : Colors.text.primary }}>
                    {WEEKDAY_LONG_FROM_MONDAY[i]}
                  </Text>
                  <Text className="text-xs text-text-secondary font-bevn-regular">
                    {formatDayMonth(date)}{isToday(date) ? ' · Hôm nay' : ''}
                  </Text>
                </View>
                {items.length === 0 ? (
                  <Text className="text-xs text-text-muted font-bevn-regular">Không có buổi dạy</Text>
                ) : (
                  items.map((s) => <CoachSessionCard key={s.id} session={s} onPress={() => openSession(s.id)} />)
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
