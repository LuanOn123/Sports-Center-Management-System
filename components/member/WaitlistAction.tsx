// components/member/WaitlistAction.tsx
// Vào danh sách chờ của một buổi hết chỗ (web: WaitlistAction). Dữ liệu ở hooks/member/useJoinWaitlist.

import React from 'react';
import { useRouter } from 'expo-router';
import { useJoinWaitlist } from '../../hooks/member/useJoinWaitlist';
import { WorkflowButton, WorkflowState, WorkflowText } from '../shared/WorkflowScreen';
import { WAITLIST_ACTION_TEXT as TEXT } from '../../constants/workflow';
import { ROUTES } from '../../navigation/routes';

export function WaitlistAction({ scheduleId }: { scheduleId: string }) {
  const router = useRouter();
  const { list, existing, join } = useJoinWaitlist(scheduleId);
  return <>
    <WorkflowButton title={existing ? TEXT.waiting(existing.position) : TEXT.join} busy={join.isPending} disabled={list.isPending || Boolean(existing) || join.isSuccess || list.isError} onPress={() => join.mutate()} />
    <WorkflowState error={list.error || join.error} retry={list.isError ? () => { void list.refetch(); } : undefined} />
    {join.isSuccess && <WorkflowText>{TEXT.joined(join.data.data.position)}</WorkflowText>}
    <WorkflowButton title={TEXT.view} secondary onPress={() => router.push(ROUTES.waitlist)} />
  </>;
}
