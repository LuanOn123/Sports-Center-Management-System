// hooks/member/useSupport.ts
// Yêu cầu hỗ trợ của hội viên: danh sách, gửi yêu cầu mới, xóa yêu cầu chưa xử lý (web: OperationsPage kind="issues")

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { createIssue, deleteIssue, getMyIssues } from '../../services/workflowService';
import { showConfirm } from '../../lib/alert';
import { SUPPORT_LIMITS, SUPPORT_TEXT } from '../../constants/workflow';

export function useSupport() {
  const { currentFacility } = useAuth();
  const cache = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const list = useQuery({ queryKey: ['issues', currentFacility?.id], queryFn: ({ signal }) => getMyIssues(signal) });
  const create = useMutation({
    mutationFn: () => createIssue({ title: subject.trim(), description: body.trim() }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      void cache.invalidateQueries({ queryKey: ['issues'] });
    },
  });
  const remove = useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => cache.invalidateQueries({ queryKey: ['issues'] }),
  });

  const requestRemove = (id: string) =>
    showConfirm(SUPPORT_TEXT.removeConfirmTitle, SUPPORT_TEXT.removeConfirmBody, () => remove.mutate(id), undefined, SUPPORT_TEXT.removeConfirmAction, true);

  return {
    list,
    create,
    remove,
    requestRemove,
    form: {
      subject, setSubject,
      body, setBody,
      canSubmit: subject.trim().length >= SUPPORT_LIMITS.subjectMin && body.trim().length >= SUPPORT_LIMITS.bodyMin,
      submit: () => create.mutate(),
    },
  };
}
