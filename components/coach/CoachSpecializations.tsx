// components/coach/CoachSpecializations.tsx
// Thẻ "Bộ môn được phép giảng dạy" ở hồ sơ HLV. Dữ liệu ở hooks/coach/useCoachSpecializations.

import React from 'react';
import { WorkflowCard, WorkflowText, WorkflowState } from '../shared/WorkflowScreen';
import { useCoachSpecializations } from '../../hooks/coach/useCoachSpecializations';
import { COACH_SPECIALIZATION_TEXT as TEXT } from '../../constants/coachProfile';

export function CoachSpecializations({ coachId }: { coachId: string }) {
  const list = useCoachSpecializations(coachId);
  return <WorkflowCard title={TEXT.title}><WorkflowState pending={list.isPending} error={list.error} retry={() => { void list.refetch(); }} />
    {list.isSuccess && <WorkflowText>{list.data.join(TEXT.separator) || TEXT.empty}</WorkflowText>}
    <WorkflowText>{TEXT.contactManager}</WorkflowText>
  </WorkflowCard>;
}
