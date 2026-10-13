import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyLeaveRequests, requestLeave } from '../../services/workflowService';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowField, WorkflowState, workflowStatus } from '../../components/shared/WorkflowScreen';
import { formatDate, formatTime } from '../../lib/format';
import { parseVietnamDateTime } from '../../lib/date';

/** Explicit GMT+7 input; do not let the device timezone move a leave interval. */
export default function CoachLeaveScreen() {
  const { currentFacility } = useAuth();
  const cache = useQueryClient();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const startTime = parseVietnamDateTime(start), endTime = parseVietnamDateTime(end);
  const valid = Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime && reason.trim().length >= 3;
  const list = useQuery({ queryKey: ['leave-requests', currentFacility?.id], queryFn: ({ signal }) => getMyLeaveRequests(signal) });
  const create = useMutation({ mutationFn: () => requestLeave({ startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(), reason: reason.trim() }), onSuccess: () => { setStart(''); setEnd(''); setReason(''); void cache.invalidateQueries({ queryKey: ['leave-requests'] }); } });
  return <WorkflowScreen title="Xin nghỉ phép" subtitle={currentFacility?.name} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
    <WorkflowCard title="Đơn nghỉ phép"><WorkflowText>Nhập ngày giờ Việt Nam (GMT+7) theo dạng YYYY-MM-DD HH:mm. Quản lý sẽ xét duyệt và điều chỉnh lịch dạy bị ảnh hưởng.</WorkflowText>
      <WorkflowField label="Bắt đầu" placeholder="2026-10-15 08:00" value={start} onChangeText={setStart} editable={!create.isPending} maxLength={16} />
      <WorkflowField label="Kết thúc" placeholder="2026-10-15 17:00" value={end} onChangeText={setEnd} editable={!create.isPending} maxLength={16} />
      {Boolean(start || end) && !valid && <WorkflowText>Kiểm tra định dạng ngày giờ, giờ kết thúc phải sau giờ bắt đầu và lý do ít nhất 3 ký tự.</WorkflowText>}
      <WorkflowField label="Lý do" value={reason} onChangeText={setReason} multiline maxLength={1000} editable={!create.isPending} />
      <WorkflowButton title="Gửi đơn nghỉ phép" busy={create.isPending} disabled={!valid} onPress={() => create.mutate()} />
      <WorkflowState error={create.error} />{create.isSuccess && <WorkflowText>Đã gửi đơn, đang chờ quản lý xét duyệt.</WorkflowText>}
    </WorkflowCard>
    <WorkflowState pending={list.isPending} error={list.error} retry={() => { void list.refetch(); }} empty={list.isSuccess && !list.data.data.length ? 'Chưa có đơn nghỉ phép.' : undefined} />
    {list.data?.data.map((leave) => <WorkflowCard key={leave.id} title={workflowStatus(leave.status)}>
      <WorkflowText>{formatDate(leave.startTime)} {formatTime(leave.startTime)} → {formatDate(leave.endTime)} {formatTime(leave.endTime)}</WorkflowText>
      <WorkflowText>{leave.reason}</WorkflowText>{leave.decisionReason && <WorkflowText>Lý do quyết định: {leave.decisionReason}</WorkflowText>}
    </WorkflowCard>)}
  </WorkflowScreen>;
}
