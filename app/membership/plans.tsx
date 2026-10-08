// app/membership/plans.tsx
// Gói thành viên của hội viên — UI ở components/member/membership

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { MembershipPlansView } from '../../components/member/membership/MembershipPlansView';

export default function MembershipPlansScreen() {
  const { user, currentFacility } = useAuth();
  return (
    <MembershipPlansView
      memberId={user?.memberProfile?.id ?? user?.id}
      scope={{ userId: user?.id, facilityId: currentFacility?.id }}
    />
  );
}
