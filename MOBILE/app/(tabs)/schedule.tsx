// app/(tabs)/schedule.tsx
// Lịch: Hội viên → lịch tập cá nhân, HLV → lịch dạy (giống web: mỗi vai trò một màn riêng)

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { MemberScheduleView } from '../../components/member/MemberScheduleView';
import { CoachScheduleView } from '../../components/coach/CoachScheduleView';

export default function ScheduleScreen() {
  const { user } = useAuth();
  if (user?.role === 'COACH') {
    return <CoachScheduleView coachId={user.coachProfile?.id ?? user.id} />;
  }
  return <MemberScheduleView />;
}
