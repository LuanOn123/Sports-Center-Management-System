// app/(tabs)/training.tsx
// Điểm danh & Quản lý dạy (Coach) — tab ẩn với Member, xem navigation/tabConfig.ts

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CoachTrainingView } from '../../components/coach/CoachTrainingView';

export default function TrainingScreen() {
  const { user } = useAuth();
  return <CoachTrainingView coachId={user?.coachProfile?.id ?? user?.id} />;
}
