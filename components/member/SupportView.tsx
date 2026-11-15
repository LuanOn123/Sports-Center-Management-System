// components/member/SupportView.tsx
// Yêu cầu hỗ trợ của hội viên (web: OperationsPage kind="issues"): gửi yêu cầu mới, xem phản hồi, xóa yêu cầu chưa xử lý.
// Logic ở hooks/member/useSupport.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowField, WorkflowState } from '../shared/WorkflowScreen';
import { useSupport } from '../../hooks/member/useSupport';
import { SUPPORT_LIMITS, SUPPORT_TEXT } from '../../constants/workflow';
import { isAttendanceReport, workflowStatus } from '../../lib/workflow';

export function SupportView() {
  const { list, create, remove, requestRemove, form } = useSupport();

  return (
    <WorkflowScreen title={SUPPORT_TEXT.title} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
      <WorkflowCard title={SUPPORT_TEXT.formTitle}>
        <WorkflowField label={SUPPORT_TEXT.subjectLabel} value={form.subject} onChangeText={form.setSubject} maxLength={SUPPORT_LIMITS.subjectMax} editable={!create.isPending} />
        <WorkflowField label={SUPPORT_TEXT.bodyLabel} value={form.body} onChangeText={form.setBody} multiline maxLength={SUPPORT_LIMITS.bodyMax} editable={!create.isPending} />
        <WorkflowButton title={SUPPORT_TEXT.submit} busy={create.isPending} disabled={!form.canSubmit} onPress={form.submit} />
        <WorkflowState error={create.error} />
        {create.isSuccess && <WorkflowText>{SUPPORT_TEXT.sent}</WorkflowText>}
      </WorkflowCard>
      <WorkflowState
        pending={list.isPending}
        error={list.error || remove.error}
        retry={() => { void list.refetch(); }}
        empty={list.isSuccess && !list.data.data.length ? SUPPORT_TEXT.empty : undefined}
      />
      {list.data?.data.map((issue) => {
        const report = isAttendanceReport(issue.description);
        return (
          <WorkflowCard key={issue.id} title={issue.title}>
            <WorkflowText>{workflowStatus(issue.status)}</WorkflowText>
            <WorkflowText>{report ? SUPPORT_TEXT.attendanceReport : issue.description}</WorkflowText>
            {Boolean(issue.response) && <WorkflowText>{SUPPORT_TEXT.response(issue.response!)}</WorkflowText>}
            {issue.status === 'OPEN' && !report && (
              <WorkflowButton title={SUPPORT_TEXT.remove} secondary busy={remove.isPending} onPress={() => requestRemove(issue.id)} />
            )}
          </WorkflowCard>
        );
      })}
    </WorkflowScreen>
  );
}
