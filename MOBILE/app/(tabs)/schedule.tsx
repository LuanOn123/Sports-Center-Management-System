// app/(tabs)/schedule.tsx
// Tab Lịch: Hội viên → Lịch tuần + Lớp của tôi (web: SchedulePage + MyClassesPage), HLV → Lịch dạy.
// `view=classes` mở thẳng phần "Lớp của tôi" (ROUTES.myClasses).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { MemberScheduleTabView, type MemberScheduleSegment } from '../../components/member/MemberScheduleTabView';
import { CoachScheduleView } from '../../components/coach/CoachScheduleView';

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { view } = useLocalSearchParams<{ view?: MemberScheduleSegment }>();
  if (user?.role === 'COACH') {
    return <CoachScheduleView coachId={user.coachProfile?.id ?? user.id} />;
  }
  return <MemberScheduleTabView initial={view} />;
}
