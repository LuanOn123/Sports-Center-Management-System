import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import type { CoachFeedback, CoachFeedbackSummary } from '../../lib/types';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../../components/shared/WorkflowScreen';

export default function CoachFeedbackScreen() {
  const { user, currentFacility } = useAuth();
  const coachId = user?.coachProfile?.id;
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['coach-feedbacks', coachId, currentFacility?.id, page], enabled: Boolean(coachId),
    queryFn: ({ signal }) => apiRequest<{ feedbacks: CoachFeedback[]; summary: CoachFeedbackSummary }>('/feedbacks', 'GET', { signal, query: { coachId, page: String(page), limit: '10' } }) });
  return <WorkflowScreen title="Đánh giá của hội viên" refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
    {!coachId ? <WorkflowState empty="Chưa có hồ sơ huấn luyện viên. Vui lòng liên hệ quản lý." /> : <>
      <WorkflowState pending={list.isPending} error={list.error} retry={() => { void list.refetch(); }} />
      {list.data && <WorkflowCard title={`${list.data.data.summary.averageRating ?? '—'} / 5`}><WorkflowText>{list.data.data.summary.totalFeedbacks} đánh giá</WorkflowText></WorkflowCard>}
      {list.isSuccess && !list.data.data.feedbacks.length && <WorkflowState empty="Chưa có đánh giá." />}
      {list.data?.data.feedbacks.map((feedback) => <WorkflowCard key={feedback.id} title={`${feedback.isAnonymous ? 'Ẩn danh' : feedback.member?.user?.fullName || 'Hội viên'} · ${feedback.rating}/5`}><WorkflowText>{feedback.comment || 'Không có nhận xét.'}</WorkflowText></WorkflowCard>)}
      <WorkflowText>Trang {page} / {list.data?.pagination?.totalPages || 1}</WorkflowText>
      <WorkflowButton title="Trang trước" secondary disabled={page <= 1 || list.isFetching} onPress={() => setPage((n) => n - 1)} />
      <WorkflowButton title="Trang sau" secondary disabled={!list.data || page >= (list.data.pagination?.totalPages || 1) || list.isFetching} onPress={() => setPage((n) => n + 1)} />
    </>}
  </WorkflowScreen>;
}
