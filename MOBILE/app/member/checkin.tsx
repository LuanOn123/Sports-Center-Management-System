import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyVisits, checkInFacility } from '../../services/workflowService';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../../components/shared/WorkflowScreen';
import { formatDate, formatTime } from '../../lib/format';
import { memberProfileIdOf } from '../../lib/businessRules';

export default function CheckInScreen() {
  const { user, currentFacility } = useAuth();
  const hasProfile = Boolean(memberProfileIdOf(user));
  const cache = useQueryClient();
  const visits = useQuery({ queryKey: ['facility-visits', currentFacility?.id], enabled: hasProfile, queryFn: ({ signal }) => getMyVisits(signal) });
  const checkIn = useMutation({ mutationFn: checkInFacility, onSuccess: () => cache.invalidateQueries({ queryKey: ['facility-visits'] }) });
  return <WorkflowScreen title="Check-in cơ sở" subtitle={currentFacility?.name} refreshing={visits.isRefetching} onRefresh={() => { void visits.refetch(); }}>
    <WorkflowCard title="Ghi nhận vào cửa"><WorkflowText>Cần gói còn hiệu lực; gói FREE cũng được vào cửa. Check-in lặp trong 5 phút sẽ trả lại lượt vừa ghi nhận.</WorkflowText>
      <WorkflowButton title="Check-in vào cơ sở" onPress={() => checkIn.mutate()} busy={checkIn.isPending} disabled={!currentFacility || !hasProfile} />
      <WorkflowState error={checkIn.error} />
      {checkIn.isSuccess && <WorkflowText>Đã ghi nhận lúc {formatTime(checkIn.data.data.checkInAt)}.</WorkflowText>}
    </WorkflowCard>
    <WorkflowText>Lịch sử vào cửa trên mọi cơ sở</WorkflowText>
    <WorkflowState pending={hasProfile && visits.isPending} error={visits.error} retry={() => { void visits.refetch(); }} empty={!hasProfile ? 'Chưa có hồ sơ hội viên.' : visits.isSuccess && !visits.data.data.length ? 'Chưa có lượt vào cửa.' : undefined} />
    {visits.data?.data.map((visit) => <WorkflowCard key={visit.id} title={visit.facility?.name || 'Cơ sở'}><WorkflowText>{formatDate(visit.checkInAt)} · {formatTime(visit.checkInAt)} · {visit.method === 'RECEPTION' ? 'Tại quầy' : 'Tự check-in'}</WorkflowText></WorkflowCard>)}
  </WorkflowScreen>;
}
