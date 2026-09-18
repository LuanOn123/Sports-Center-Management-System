// app/(tabs)/training.tsx
// Màn hình Tập luyện (Member) / Điểm danh & Quản lý dạy (Coach)

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CoachTrainingView } from '../../components/coach/CoachTrainingView';
import { MemberTrainingView } from '../../components/member/MemberTrainingView';

export default function TrainingScreen() {
  const { user } = useAuth();
  const isCoach = user?.role === 'COACH';

  if (isCoach) {
    return <CoachTrainingView coachId={user?.coachProfile?.id ?? user?.id} />;
  }

  return <MemberTrainingView memberId={user?.memberProfile?.id ?? user?.id} />;
}
