// components/account/PoliciesView.tsx
// Chính sách sử dụng (web: shared/Policies.tsx) — quy định về gói, đặt lớp, điểm danh, chuyên cần, thanh toán và hoàn tiền.
// Nội dung ở constants/policies.ts, giữ đúng lời của web.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText } from '../shared/WorkflowScreen';
import { POLICIES_INTRO, POLICIES_TITLE, POLICY_SECTIONS } from '../../constants/policies';

export function PoliciesView() {
  return (
    <WorkflowScreen title={POLICIES_TITLE}>
      <WorkflowText>{POLICIES_INTRO}</WorkflowText>
      {POLICY_SECTIONS.map((section) => (
        <WorkflowCard key={section.title} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <WorkflowText key={paragraph}>{paragraph}</WorkflowText>
          ))}
        </WorkflowCard>
      ))}
    </WorkflowScreen>
  );
}
