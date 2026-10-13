import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { allPages } from '../../lib/pagedApi';
import { WorkflowCard, WorkflowText, WorkflowState } from '../shared/WorkflowScreen';
import { useAuth } from '../../context/AuthContext';
import type { Sport } from '../../lib/types';

export function CoachSpecializations({ coachId }: { coachId: string }) {
  const { currentFacility } = useAuth();
  const list = useQuery({ queryKey: ['coach-assigned-sports', coachId, currentFacility?.id], queryFn: async ({ signal }) => {
    const [assigned, sports] = await Promise.all([
      apiRequest<Array<{ sportId: string }>>(`/coaches/${encodeURIComponent(coachId)}/specializations`, 'GET', { signal }),
      allPages<Sport>('/sports', {}, signal),
    ]);
    return assigned.data.map((item) => sports.data.find((sport) => sport.id === item.sportId)?.name || 'Bộ môn chưa xác định');
  } });
  return <WorkflowCard title="Bộ môn được phép giảng dạy"><WorkflowState pending={list.isPending} error={list.error} retry={() => { void list.refetch(); }} />
    {list.isSuccess && <WorkflowText>{list.data.join(' · ') || 'Chưa được phân công bộ môn.'}</WorkflowText>}
    <WorkflowText>Liên hệ quản lý khi cần cập nhật chuyên môn hoặc bộ môn giảng dạy.</WorkflowText>
  </WorkflowCard>;
}
