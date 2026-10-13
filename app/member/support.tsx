import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyIssues, createIssue, deleteIssue } from '../../services/workflowService';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowField, WorkflowState, workflowStatus } from '../../components/shared/WorkflowScreen';
import { showConfirm } from '../../lib/alert';

export default function SupportScreen() {
  const { currentFacility } = useAuth();
  const cache = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const list = useQuery({ queryKey: ['issues', currentFacility?.id], queryFn: ({ signal }) => getMyIssues(signal) });
  const create = useMutation({ mutationFn: () => createIssue({ title: title.trim(), description: description.trim() }), onSuccess: () => { setTitle(''); setDescription(''); void cache.invalidateQueries({ queryKey: ['issues'] }); } });
  const remove = useMutation({ mutationFn: deleteIssue, onSuccess: () => cache.invalidateQueries({ queryKey: ['issues'] }) });
  return <WorkflowScreen title="Yêu cầu hỗ trợ" subtitle={currentFacility?.name} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
    <WorkflowCard title="Gửi yêu cầu"><WorkflowField label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={120} editable={!create.isPending} />
      <WorkflowField label="Nội dung" value={description} onChangeText={setDescription} multiline maxLength={3000} editable={!create.isPending} />
      <WorkflowButton title="Gửi yêu cầu" busy={create.isPending} disabled={title.trim().length < 3 || description.trim().length < 5} onPress={() => create.mutate()} />
      <WorkflowState error={create.error} />{create.isSuccess && <WorkflowText>Đã gửi yêu cầu đến trung tâm.</WorkflowText>}
    </WorkflowCard>
    <WorkflowState pending={list.isPending} error={list.error || remove.error} retry={() => { void list.refetch(); }} empty={list.isSuccess && !list.data.data.length ? 'Chưa có yêu cầu hỗ trợ.' : undefined} />
    {list.data?.data.map((issue) => <WorkflowCard key={issue.id} title={issue.title}>
      <WorkflowText>{workflowStatus(issue.status)}</WorkflowText><WorkflowText>{issue.description.includes('"ATTENDANCE_VIOLATION"') ? 'Báo cáo chuyên cần đã được gửi đến quản lý. Xem chi tiết tỷ lệ và quyết định tại mục Chuyên cần.' : issue.description}</WorkflowText>
      {issue.response && <WorkflowText>Phản hồi: {issue.response}</WorkflowText>}
      {issue.status === 'OPEN' && !issue.description.includes('"ATTENDANCE_VIOLATION"') && <WorkflowButton title="Xóa yêu cầu" secondary busy={remove.isPending} onPress={() => showConfirm('Xóa yêu cầu', 'Xóa yêu cầu hỗ trợ chưa được xử lý?', () => remove.mutate(issue.id), undefined, 'Xóa', true)} />}
    </WorkflowCard>)}
  </WorkflowScreen>;
}
