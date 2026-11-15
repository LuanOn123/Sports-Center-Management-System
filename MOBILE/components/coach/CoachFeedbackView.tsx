// components/coach/CoachFeedbackView.tsx
// "Đánh giá của hội viên" dành cho huấn luyện viên (web: /coach/feedback → CoachFeedback): điểm trung bình, danh sách đánh giá,
// phân trang. Logic ở hooks/coach/useCoachFeedbackScreen.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { useCoachFeedbackScreen } from '../../hooks/coach/useCoachFeedbackScreen';
import { COACH_FEEDBACK_TEXT as TEXT } from '../../constants/workflow';

export function CoachFeedbackView() {
  const f = useCoachFeedbackScreen();
  const { list } = f;
  const summary = list.data?.data.summary;

  return (
    <WorkflowScreen title={TEXT.title} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
      {!f.coachId ? (
        <WorkflowState empty={TEXT.noProfile} />
      ) : (
        <>
          <WorkflowState pending={list.isPending} error={list.error} retry={() => { void list.refetch(); }} />
          {summary && (
            <WorkflowCard title={TEXT.average(summary.averageRating)}>
              <WorkflowText>{TEXT.total(summary.totalFeedbacks)}</WorkflowText>
            </WorkflowCard>
          )}
          {list.isSuccess && !list.feedbacks.length && <WorkflowState empty={TEXT.empty} />}
          {list.feedbacks.map((feedback) => (
            <WorkflowCard key={feedback.id} title={`${feedback.isAnonymous ? TEXT.anonymous : feedback.member?.user?.fullName || TEXT.memberFallback} · ${feedback.rating}/5`}>
              <WorkflowText>{feedback.comment || TEXT.noComment}</WorkflowText>
            </WorkflowCard>
          ))}
          <WorkflowText>{TEXT.page(f.page, f.totalPages)}</WorkflowText>
          <WorkflowButton title={TEXT.previous} secondary disabled={!f.canGoBack} onPress={f.previous} />
          <WorkflowButton title={TEXT.next} secondary disabled={!f.canGoForward} onPress={f.next} />
        </>
      )}
    </WorkflowScreen>
  );
}
