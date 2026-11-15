// components/member/WaitlistView.tsx
// Danh sách chờ của hội viên (web: Waitlist): các buổi đang chờ chỗ, rời danh sách. Logic ở hooks/member/useWaitlistScreen.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { useWaitlistScreen } from '../../hooks/member/useWaitlistScreen';
import { MEMBER_PROFILE_MISSING, WAITLIST_TEXT } from '../../constants/workflow';
import { formatDate, formatTime } from '../../lib/format';
import { workflowStatus } from '../../lib/workflow';

export function WaitlistView() {
  const { hasProfile, list, leave, requestLeave } = useWaitlistScreen();
  const empty = !hasProfile ? MEMBER_PROFILE_MISSING : list.isSuccess && !list.data.data.length ? WAITLIST_TEXT.empty : undefined;

  return (
    <WorkflowScreen title={WAITLIST_TEXT.title} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
      <WorkflowText>{WAITLIST_TEXT.intro}</WorkflowText>
      <WorkflowState pending={hasProfile && list.isPending} error={list.error || leave.error} retry={() => { void list.refetch(); }} empty={empty} />
      {list.data?.data.map((entry) => (
        <WorkflowCard key={entry.id} title={entry.schedule?.class?.name || WAITLIST_TEXT.sessionFallback}>
          <WorkflowText>{entry.schedule && `${formatDate(entry.schedule.startTime)} · ${formatTime(entry.schedule.startTime)}`}</WorkflowText>
          <WorkflowText>{WAITLIST_TEXT.position(entry.position, workflowStatus(entry.status))}</WorkflowText>
          {entry.status === 'WAITING' && (
            <WorkflowButton title={WAITLIST_TEXT.leave} secondary busy={leave.isPending} onPress={() => requestLeave(entry.id)} />
          )}
        </WorkflowCard>
      ))}
    </WorkflowScreen>
  );
}
