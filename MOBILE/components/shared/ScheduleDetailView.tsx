// components/shared/ScheduleDetailView.tsx
// Chi tiết một buổi học (dùng chung). Phần hành động theo vai trò truyền vào qua renderActions:
// Hội viên → components/member/MemberScheduleActions, HLV → components/coach/CoachScheduleActions

import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { ScreenHeader } from './ScreenHeader';
import { useScheduleDetail } from '../../hooks/shared/useScheduleDetail';
import { Colors, Spacing } from '../../constants/theme';
import { SCHEDULE_STATUS_COLOR, SCHEDULE_STATUS_LABEL } from '../../constants/schedule';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import { ROUTES } from '../../navigation/routes';
import type { ClassSchedule } from '../../lib/types';

export interface ScheduleActionsContext {
  schedule: ClassSchedule;
  isFull: boolean;
  isPast: boolean;
}

interface ScheduleDetailViewProps {
  scheduleId: string | undefined;
  renderActions: (ctx: ScheduleActionsContext) => React.ReactNode;
}

function InfoTile({ icon, label, value, danger }: { icon: string; label: string; value: string; danger?: boolean }) {
  return (
    <View className="w-[47%] bg-bg-elevated rounded-lg p-md">
      <Icon name={icon} size={20} color={Colors.primary} style={{ marginBottom: Spacing.xs }} />
      <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">{label}</Text>
      <Text className="text-sm font-bevn-semibold mt-0.5" style={{ color: danger ? Colors.status.cancelled : Colors.text.primary }}>{value}</Text>
    </View>
  );
}

export function ScheduleDetailView({ scheduleId, renderActions }: ScheduleDetailViewProps) {
  const router = useRouter();
  const { schedule: s, isLoading, isFull, isPast, slotsLeft } = useScheduleDetail(scheduleId);

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.schedule);
  };

  const header = <ScreenHeader title={s?.class?.name ?? 'Chi tiết buổi học'} onBackPress={handleGoBack} />;

  if (isLoading || !s) {
    return (
      <View className="flex-1 bg-bg-primary">
        {header}
        <View className="flex-1 justify-center items-center">
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} size="large" />
          ) : (
            <Text className="text-text-muted text-md font-bevn-regular">Không tìm thấy lịch học</Text>
          )}
        </View>
      </View>
    );
  }

  const statusColor = SCHEDULE_STATUS_COLOR[s.status];

  return (
    <View className="flex-1 bg-bg-primary">
      {header}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: Spacing.xl, paddingBottom: Spacing.xxxl }}>
        {/* Trạng thái (chỉ khi đã hủy / đã hoàn thành) */}
        {s.status !== 'SCHEDULED' && (
          <View className="rounded-lg p-md mb-lg border items-center" style={{ backgroundColor: statusColor + '15', borderColor: statusColor + '40' }}>
            <Text className="text-sm font-bevn-bold" style={{ color: statusColor }}>{SCHEDULE_STATUS_LABEL[s.status]}</Text>
          </View>
        )}

        {/* Thông tin chính */}
        <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
          <Text className="text-xxl font-bevn-bold text-text-primary mb-xs">{s.class?.name ?? 'Lớp học'}</Text>
          {Boolean(s.class?.sports?.length) && (
            <View className="flex-row items-center gap-1.5 mb-1">
              <Icon name="sports" size={16} color={Colors.primary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">{s.class!.sports!.map((sp) => sp.name).join(', ')}</Text>
            </View>
          )}
          <View className="flex-row flex-wrap gap-md mt-md">
            <InfoTile icon="calendar-today" label="Ngày" value={formatWeekdayDate(s.startTime, 'long')} />
            <InfoTile icon="access-time" label="Thời gian" value={`${formatTime(s.startTime)} – ${formatTime(s.endTime)}`} />
            <InfoTile icon="place" label="Phòng tập" value={s.room?.name ?? '—'} />
            <InfoTile icon="group" label="Chỗ còn lại" value={isFull ? 'Hết chỗ' : `${slotsLeft} chỗ`} danger={isFull} />
          </View>
        </View>

        {/* Phòng */}
        {Boolean(s.room) && (
          <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
            <Text className="text-md font-bevn-bold text-text-primary mb-md">Thông tin phòng</Text>
            <Text className="text-lg font-bevn-semibold text-primary mb-sm">{s.room!.name}</Text>
            {Boolean(s.room!.location) && (
              <View className="flex-row items-center gap-1.5 mb-1">
                <Icon name="place" size={14} color={Colors.text.secondary} />
                <Text className="text-sm text-text-secondary font-bevn-regular">{s.room!.location}</Text>
              </View>
            )}
            {Boolean(s.room!.capacity) && (
              <View className="flex-row items-center gap-1.5 mb-1">
                <Icon name="group" size={14} color={Colors.text.secondary} />
                <Text className="text-sm text-text-secondary font-bevn-regular">Sức chứa: {s.room!.capacity} người</Text>
              </View>
            )}
          </View>
        )}

        {/* Huấn luyện viên */}
        <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
          <Text className="text-md font-bevn-bold text-text-primary mb-md">Huấn luyện viên</Text>
          {s.class?.coaches && s.class.coaches.length > 0 ? (
            s.class.coaches.map((c) => (
              <View key={c.coachId} className="flex-row items-center bg-bg-elevated rounded-lg p-md mb-xs">
                <View className="w-10 h-10 rounded-full bg-bg-surface justify-center items-center mr-md">
                  <Text className="text-lg font-bevn-bold text-primary">{c.coach?.user?.fullName?.charAt(0) ?? '?'}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-sm mb-0.5">
                    <Text className="text-md font-bevn-bold text-text-primary">{c.coach?.user?.fullName ?? '—'}</Text>
                    {Boolean(c.isPrimary) && (
                      <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: Colors.primary + '20' }}>
                        <Text className="text-xs text-primary font-bevn-semibold">Chính</Text>
                      </View>
                    )}
                  </View>
                  {Boolean(c.coach?.specialization) && (
                    <View className="flex-row items-center gap-1.5">
                      <Icon name="star-outline" size={14} color={Colors.text.secondary} />
                      <Text className="text-xs text-text-secondary font-bevn-regular">{c.coach!.specialization}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text className="text-text-muted text-sm font-bevn-regular italic">Chưa phân công huấn luyện viên</Text>
          )}
        </View>

        {renderActions({ schedule: s, isFull, isPast })}
      </ScrollView>
    </View>
  );
}
