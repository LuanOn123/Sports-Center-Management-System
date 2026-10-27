// components/coach/CoachChangesView.tsx
// Màn "Đổi HLV theo buổi" của Huấn luyện viên (web: /coach/coach-changes) — thay cho "Xin nghỉ phép" cũ.
// Danh sách yêu cầu theo trạng thái + nút tạo yêu cầu cố định dưới đáy.

import React from 'react';
import { View, Text } from 'react-native';
import { WorkflowScreen, WorkflowState, WorkflowText } from '../shared/WorkflowScreen';
import { Icon } from '../shared/Icon';
import { Button, Card, EmptyState, Segmented, StatusBadge } from '../ui';
import { Colors } from '../../constants/theme';
import {
  COACH_CHANGE_FILTERS, COACH_CHANGE_STATUS_COLOR, COACH_CHANGE_STATUS_LABEL, COACH_CHANGE_TEXT,
} from '../../constants/coachChanges';
import { formatSessionWindow } from '../../lib/coachChange';
import { useCoachChanges } from '../../hooks/coach/useCoachChanges';
import type { CoachChangeRequest } from '../../services/coachChangeService';
import { CoachChangeRequestSheet } from './CoachChangeRequestSheet';

function CoachChangeCard({ row }: { row: CoachChangeRequest }) {
  const color = COACH_CHANGE_STATUS_COLOR[row.status] ?? Colors.text.muted;
  return (
    <Card accent={color} className="gap-sm">
      <View className="flex-row items-start gap-sm">
        <View className="w-9 h-9 rounded-md items-center justify-center" style={{ backgroundColor: color + '22' }}>
          <Icon name="swap-horiz" size={20} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-md text-text-primary font-bevn-bold" numberOfLines={2}>{row.schedule.class.name}</Text>
          <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">
            {formatSessionWindow(row.requestedStartTime, row.requestedEndTime)}
            {row.schedule.room?.name ? ` · ${row.schedule.room.name}` : ''}
          </Text>
        </View>
        <StatusBadge label={COACH_CHANGE_STATUS_LABEL[row.status] ?? row.status} color={color} />
      </View>
      <Text className="text-sm text-text-primary font-bevn-regular leading-[20px]">{row.reason}</Text>
      {row.replacement && (
        <Text className="text-sm text-text-secondary font-bevn-regular">
          {COACH_CHANGE_TEXT.replacement}: <Text className="text-text-primary font-bevn-semibold">{row.replacement.user.fullName}</Text>
        </Text>
      )}
      {row.decisionReason ? (
        <View className="bg-bg-elevated rounded-md p-sm">
          <Text className="text-xs text-text-secondary font-bevn-regular leading-[18px]">{COACH_CHANGE_TEXT.managerReply}: {row.decisionReason}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function CoachChangesView() {
  const { list, rows, filter, setFilter, sheet, refresh } = useCoachChanges();
  const hasAny = Boolean(list.data?.length);

  return (
    <>
      <WorkflowScreen
        title={COACH_CHANGE_TEXT.title}
        refreshing={list.isRefetching}
        onRefresh={refresh}
        footer={<Button title={COACH_CHANGE_TEXT.create} icon="add" onPress={sheet.show} />}
      >
        <WorkflowText>{COACH_CHANGE_TEXT.intro}</WorkflowText>
        <Segmented options={COACH_CHANGE_FILTERS} value={filter} onChange={setFilter} />
        <WorkflowState pending={list.isPending} error={list.error} retry={refresh} />
        {list.isSuccess && !rows.length && (
          <EmptyState
            icon="swap-horiz"
            title={COACH_CHANGE_TEXT.empty}
            description={hasAny ? 'Không có yêu cầu nào ở trạng thái này.' : COACH_CHANGE_TEXT.emptyDetail}
          />
        )}
        {rows.map((row) => <CoachChangeCard key={row.id} row={row} />)}
      </WorkflowScreen>
      <CoachChangeRequestSheet sheet={sheet} />
    </>
  );
}
