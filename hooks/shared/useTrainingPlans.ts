// hooks/shared/useTrainingPlans.ts
// Giáo án tập luyện của một lớp (web: shared/TrainingPlans). Hội viên đã đăng ký xem giáo án giao cả lớp / riêng mình;
// HLV được phân công xem mọi giáo án, tạo giáo án mới, sửa giáo án của mình và nhờ AI soạn bản nháp.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { createTrainingPlan, getTrainingPlans, suggestTrainingPlan, updateTrainingPlan } from '../../services/trainingPlanService';
import { TRAINING_PLAN_TEXT as TEXT } from '../../constants/trainingPlans';
import { showAlert } from '../../lib/alert';
import {
  canSubmitTrainingPlan, createPlanBody, EMPTY_TRAINING_PLAN_FORM, planToForm, recipientLabel, trainingPlanErrors, updatePlanBody,
  type TrainingPlanForm,
} from '../../lib/trainingPlans';
import type { TrainingPlan, TrainingPlanMember } from '../../lib/types';

/** Tiền tố khóa cache — sau khi HLV giao / sửa giáo án (hoặc hội viên đăng ký lớp) thì làm mới mọi bản của lớp đó */
export const TRAINING_PLANS_KEY = 'training-plans';
const KEY = TRAINING_PLANS_KEY;

/** Danh sách giáo án của lớp (cache theo cơ sở hiện tại vì BE lọc theo X-Facility-Id) */
export function useTrainingPlans(classId: string, coach: boolean) {
  const { currentFacility } = useAuth();
  return useQuery({
    queryKey: [KEY, classId, currentFacility?.id, coach],
    enabled: Boolean(classId),
    queryFn: ({ signal }) => getTrainingPlans(classId, signal),
    select: (res) => res.data,
  });
}

/** Form tạo / sửa giáo án của HLV: ô nhập, nhờ AI soạn nháp, giao hoặc lưu */
export function useTrainingPlanEditor(classId: string, members: readonly TrainingPlanMember[]) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrainingPlanForm>(EMPTY_TRAINING_PLAN_FORM);
  const [objective, setObjective] = useState('');

  const save = useMutation({
    mutationFn: () => (editingId ? updateTrainingPlan(classId, editingId, updatePlanBody(form)) : createTrainingPlan(classId, createPlanBody(form))),
    onSuccess: () => {
      const message = editingId ? TEXT.saved : TEXT.assignedTo(recipientLabel(form.memberId, members));
      setOpen(false);
      void cache.invalidateQueries({ queryKey: [KEY, classId] });
      showAlert(TEXT.savedTitle, message);
    },
  });
  const suggest = useMutation({
    mutationFn: () => suggestTrainingPlan(classId, { memberId: form.memberId || null, objective: objective.trim() || undefined }),
    onSuccess: (res) => {
      const draft = res.data.draft?.trim();
      if (draft) setForm((previous) => ({ ...previous, instructions: draft }));
    },
  });
  const busy = save.isPending || suggest.isPending;

  const begin = (plan: TrainingPlan | null) => {
    save.reset();
    suggest.reset();
    setEditingId(plan?.id ?? null);
    setForm(plan ? planToForm(plan) : EMPTY_TRAINING_PLAN_FORM);
    setObjective('');
    setOpen(true);
  };

  return {
    open,
    /** Đang sửa một giáo án có sẵn (người nhận không đổi được) */
    editing: editingId !== null,
    form,
    setField: <K extends keyof TrainingPlanForm>(key: K, value: TrainingPlanForm[K]) => setForm((previous) => ({ ...previous, [key]: value })),
    objective,
    setObjective,
    errors: trainingPlanErrors(form),
    canSubmit: canSubmitTrainingPlan(form) && !busy,
    busy,
    recipient: recipientLabel(form.memberId, members),
    openCreate: () => begin(null),
    openEdit: (plan: TrainingPlan) => begin(plan),
    /** Đóng bảng; bị chặn khi đang gửi để không mất thao tác giữa chừng */
    close: () => {
      if (!busy) setOpen(false);
    },
    submit: () => {
      if (canSubmitTrainingPlan(form) && !busy) save.mutate();
    },
    save: { isPending: save.isPending, error: save.error },
    suggest: {
      run: () => {
        if (!busy) suggest.mutate();
      },
      isPending: suggest.isPending,
      error: suggest.error,
      /** AI đã điền nháp vào nội dung ('filled') hay không trả được gì ('empty'); null khi chưa nhờ AI */
      outcome: suggest.isSuccess ? (suggest.data.data.draft?.trim() ? ('filled' as const) : ('empty' as const)) : null,
    },
  };
}

export type TrainingPlanEditor = ReturnType<typeof useTrainingPlanEditor>;
