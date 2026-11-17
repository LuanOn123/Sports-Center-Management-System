// app/coach/attendance/[scheduleId].tsx
// Điểm danh một buổi (danh sách học viên): màn con của khu vực coach, đẩy lên trên tabs — vuốt từ trái sang phải quay về đúng màn đã mở nó.
// UI ở components/coach/CoachRosterView.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CoachRosterView } from '../../../components/coach/CoachRosterView';

export default function CoachRosterScreen() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  return <CoachRosterView scheduleId={scheduleId} />;
}
