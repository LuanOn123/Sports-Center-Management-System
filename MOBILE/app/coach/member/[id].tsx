import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import type { User } from '../../../lib/types';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowState } from '../../../components/shared/WorkflowScreen';

type Learner = { id: string; user?: User; trainingLevel?: string; fitnessGoal?: string; trainingPreference?: string };
export default function LearnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentFacility } = useAuth();
  const detail = useQuery({ queryKey: ['coach-member', id, currentFacility?.id], enabled: Boolean(id), queryFn: ({ signal }) => apiRequest<Learner>(`/members/${encodeURIComponent(id)}`, 'GET', { signal }) });
  const learner = detail.data?.data;
  const level = ({ BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' } as Record<string, string>)[learner?.trainingLevel || ''];
  return <WorkflowScreen title="Hồ sơ học viên"><WorkflowState pending={detail.isPending} error={detail.error} retry={() => { void detail.refetch(); }} />
    {learner && <WorkflowCard title={learner.user?.fullName || 'Học viên'}>
      <WorkflowText>Email: {learner.user?.email || '—'}</WorkflowText><WorkflowText>Điện thoại: {learner.user?.phone || '—'}</WorkflowText>
      <WorkflowText>Trình độ: {level || 'Chưa cập nhật'}</WorkflowText><WorkflowText>Mục tiêu: {learner.fitnessGoal || 'Chưa cập nhật'}</WorkflowText>
      <WorkflowText>Thời gian yêu thích: {learner.trainingPreference || 'Chưa cập nhật'}</WorkflowText>
    </WorkflowCard>}
  </WorkflowScreen>;
}
