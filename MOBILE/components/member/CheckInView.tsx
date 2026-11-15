// components/member/CheckInView.tsx
// Check-in cơ sở của hội viên (web: FacilityVisits): ghi nhận lượt vào cửa + lịch sử vào cửa trên mọi cơ sở. Logic ở hooks/member/useCheckIn.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { useCheckIn } from '../../hooks/member/useCheckIn';
import { CHECKIN_TEXT, MEMBER_PROFILE_MISSING, VISIT_METHOD_RECEPTION } from '../../constants/workflow';
import { formatDate, formatTime } from '../../lib/format';

export function CheckInView() {
  const { hasProfile, canCheckIn, visits, checkIn } = useCheckIn();
  const empty = !hasProfile ? MEMBER_PROFILE_MISSING : visits.isSuccess && !visits.data.data.length ? CHECKIN_TEXT.empty : undefined;

  return (
    <WorkflowScreen title={CHECKIN_TEXT.title} refreshing={visits.isRefetching} onRefresh={() => { void visits.refetch(); }}>
      <WorkflowCard title={CHECKIN_TEXT.cardTitle}>
        <WorkflowText>{CHECKIN_TEXT.intro}</WorkflowText>
        <WorkflowButton title={CHECKIN_TEXT.action} onPress={() => checkIn.mutate()} busy={checkIn.isPending} disabled={!canCheckIn} />
        <WorkflowState error={checkIn.error} />
        {checkIn.isSuccess && <WorkflowText>{CHECKIN_TEXT.recorded(formatTime(checkIn.data.data.checkInAt))}</WorkflowText>}
      </WorkflowCard>
      <WorkflowText>{CHECKIN_TEXT.historyTitle}</WorkflowText>
      <WorkflowState pending={hasProfile && visits.isPending} error={visits.error} retry={() => { void visits.refetch(); }} empty={empty} />
      {visits.data?.data.map((visit) => (
        <WorkflowCard key={visit.id} title={visit.facility?.name || CHECKIN_TEXT.facilityFallback}>
          <WorkflowText>
            {formatDate(visit.checkInAt)} · {formatTime(visit.checkInAt)} · {visit.method === VISIT_METHOD_RECEPTION ? CHECKIN_TEXT.byReception : CHECKIN_TEXT.selfService}
          </WorkflowText>
        </WorkflowCard>
      ))}
    </WorkflowScreen>
  );
}
