import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyWaitlist, leaveWaitlist } from '../../services/workflowService';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState, workflowStatus } from '../../components/shared/WorkflowScreen';
import { formatDate, formatTime } from '../../lib/format';
import { showConfirm } from '../../lib/alert';
import { memberProfileIdOf } from '../../lib/businessRules';

export default function WaitlistScreen() {
  const { user, currentFacility } = useAuth();
  const hasProfile = Boolean(memberProfileIdOf(user));
  const cache = useQueryClient();
  const list = useQuery({ queryKey: ['waitlist', currentFacility?.id], enabled: hasProfile, queryFn: ({ signal }) => getMyWaitlist(signal), refetchInterval: 30_000 });
  const leave = useMutation({ mutationFn: leaveWaitlist, onSettled: () => cache.invalidateQueries({ queryKey: ['waitlist'] }) });
  const promoted = list.data?.data.filter((entry) => entry.status === 'PROMOTED').map((entry) => entry.id).sort().join(',') || '';
  useEffect(() => {
    if (promoted) for (const key of ['my-enrollments', 'my-enrollments-upcoming', 'enrollment-quota', 'member-schedule', 'class-schedules', 'course-plan']) void cache.invalidateQueries({ queryKey: [key] });
  }, [promoted, cache]);
  return <WorkflowScreen title="Danh sách chờ" refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
    <WorkflowText>Khi có chỗ trống, hệ thống xét theo thứ tự chờ và kiểm tra lại gói tập, quota, lịch học và quyết định chuyên cần. Vào danh sách chờ chưa đảm bảo có chỗ.</WorkflowText>
    <WorkflowState pending={hasProfile && list.isPending} error={list.error || leave.error} retry={() => { void list.refetch(); }} empty={!hasProfile ? 'Chưa có hồ sơ hội viên.' : list.isSuccess && !list.data.data.length ? 'Chưa có lượt đăng ký chờ.' : undefined} />
    {list.data?.data.map((entry) => <WorkflowCard key={entry.id} title={entry.schedule?.class?.name || 'Buổi học'}>
      <WorkflowText>{entry.schedule && `${formatDate(entry.schedule.startTime)} · ${formatTime(entry.schedule.startTime)}`}</WorkflowText>
      <WorkflowText>Thứ tự {entry.position} · {workflowStatus(entry.status)}</WorkflowText>
      {entry.status === 'WAITING' && <WorkflowButton title="Rời danh sách chờ" secondary busy={leave.isPending} onPress={() => showConfirm('Rời danh sách chờ', 'Bạn sẽ mất vị trí chờ của buổi này.', () => leave.mutate(entry.id), undefined, 'Rời danh sách')} />}
    </WorkflowCard>)}
  </WorkflowScreen>;
}
