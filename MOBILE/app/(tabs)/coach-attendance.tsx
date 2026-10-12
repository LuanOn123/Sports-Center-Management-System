// app/(tabs)/coach-attendance.tsx
// Điểm danh của HLV (chỉ COACH — chặn ở navigation/routes.ts); UI ở components/coach

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { CoachAttendanceView } from '../../components/coach/CoachAttendanceView';

export default function CoachAttendanceScreen() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId?: string }>();
  const { user } = useAuth();
  return <CoachAttendanceView coachId={user?.coachProfile?.id ?? user?.id} initialScheduleId={scheduleId} />;
}
