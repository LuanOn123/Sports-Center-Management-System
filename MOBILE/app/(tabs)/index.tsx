// app/(tabs)/index.tsx
// Trang chủ: điều hướng theo vai trò (Coach vs Member)

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CoachHomeView } from '../../components/coach/CoachHomeView';
import { MemberHomeView } from '../../components/member/MemberHomeView';

export default function HomeScreen() {
  const { user } = useAuth();
  const isCoach = user?.role === 'COACH';

  if (isCoach) {
    return <CoachHomeView user={user} />;
  }

  return <MemberHomeView user={user} />;
}
