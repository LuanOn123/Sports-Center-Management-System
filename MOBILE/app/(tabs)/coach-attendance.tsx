// app/(tabs)/coach-attendance.tsx
// Điểm danh của HLV (chỉ COACH — chặn ở navigation/routes.ts): danh sách buổi để chọn; danh sách học viên của một buổi là
// app/coach/attendance/[scheduleId].tsx. UI ở components/coach

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CoachAttendanceView } from '../../components/coach/CoachAttendanceView';

export default function CoachAttendanceScreen() {
  const { user } = useAuth();
  return <CoachAttendanceView coachId={user?.coachProfile?.id} />;
}
