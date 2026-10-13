import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getMyWaitlist, joinWaitlist } from '../../services/workflowService';
import { WorkflowButton, WorkflowState, WorkflowText } from '../shared/WorkflowScreen';
import { ROUTES } from '../../navigation/routes';

export function WaitlistAction({ scheduleId }: { scheduleId: string }) {
  const cache = useQueryClient();
  const router = useRouter();
  const { currentFacility } = useAuth();
  const list = useQuery({ queryKey: ['waitlist', currentFacility?.id], queryFn: ({ signal }) => getMyWaitlist(signal) });
  const existing = list.data?.data.find((entry) => entry.scheduleId === scheduleId && entry.status === 'WAITING');
  const join = useMutation({ mutationFn: () => joinWaitlist(scheduleId), onSuccess: () => cache.invalidateQueries({ queryKey: ['waitlist'] }) });
  return <>
    <WorkflowButton title={existing ? `Đang chờ · thứ tự ${existing.position}` : 'Vào danh sách chờ'} busy={join.isPending} disabled={list.isPending || Boolean(existing) || join.isSuccess || list.isError} onPress={() => join.mutate()} />
    <WorkflowState error={list.error || join.error} retry={list.isError ? () => { void list.refetch(); } : undefined} />
    {join.isSuccess && <WorkflowText>Đã vào danh sách chờ · thứ tự {join.data.data.position}.</WorkflowText>}
    <WorkflowButton title="Xem danh sách chờ" secondary onPress={() => router.push(ROUTES.waitlist)} />
  </>;
}
