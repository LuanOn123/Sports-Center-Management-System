// app/schedule/[scheduleId].tsx
// Chi tiết buổi học — UI chung ở components/shared/ScheduleDetailView, hành động theo vai trò

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ScheduleDetailView } from '../../components/shared/ScheduleDetailView';
import { MemberScheduleActions } from '../../components/member/MemberScheduleActions';
import { CoachScheduleActions } from '../../components/coach/CoachScheduleActions';

export default function ScheduleDetailScreen() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const { user } = useAuth();
  const isCoach = user?.role === 'COACH';
  return (
    <ScheduleDetailView
      scheduleId={scheduleId}
      renderActions={(ctx) => (isCoach ? <CoachScheduleActions {...ctx} /> : <MemberScheduleActions {...ctx} />)}
    />
  );
}
