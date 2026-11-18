// components/classes/TrainingPlansSection.tsx
// "Giáo án tập luyện" ở chi tiết lớp (web: shared/TrainingPlans, dùng ở trang lớp của hội viên và cửa sổ lớp của HLV).
// Hội viên đã đăng ký chỉ đọc; HLV được phân công thêm nút tạo giáo án và sửa giáo án của chính mình.

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { WorkflowCard, WorkflowState } from '../shared/WorkflowScreen';
import { Button } from '../ui/Button';
import { TrainingPlanSheet } from './TrainingPlanSheet';
import { useTrainingPlanEditor, useTrainingPlans } from '../../hooks/shared/useTrainingPlans';
import { TRAINING_PLAN_TEXT as TEXT } from '../../constants/trainingPlans';
import { Colors } from '../../constants/theme';
import { planTargetLabel } from '../../lib/trainingPlans';
import type { TrainingPlan } from '../../lib/types';

function PlanCard({ plan, onEdit }: { plan: TrainingPlan; onEdit?: (plan: TrainingPlan) => void }) {
  return (
    <WorkflowCard>
      <View className="flex-row items-start justify-between gap-sm">
        <Text className="flex-1 text-md font-bevn-bold text-text-primary">{plan.title}</Text>
        <View className="rounded-full px-sm py-0.5 max-w-[45%]" style={{ backgroundColor: Colors.status.scheduled + '20' }}>
          <Text className="text-xs font-bevn-semibold" numberOfLines={1} style={{ color: Colors.status.scheduled }}>{planTargetLabel(plan)}</Text>
        </View>
      </View>
      {plan.coach ? <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.coach(plan.coach.user.fullName)}</Text> : null}
      <Text selectable className="text-sm text-text-secondary font-bevn-regular leading-[21px]">{plan.instructions}</Text>
      {plan.homework ? (
        <View className="rounded-md p-md gap-xs" style={{ backgroundColor: Colors.status.pending + '14', borderLeftWidth: 3, borderLeftColor: Colors.status.pending }}>
          <Text className="text-sm font-bevn-bold text-text-primary">{TEXT.homework}</Text>
          <Text selectable className="text-sm text-text-secondary font-bevn-regular leading-[21px]">{plan.homework}</Text>
        </View>
      ) : null}
      {plan.editable && onEdit ? (
        <Button variant="secondary" size="sm" block={false} icon="edit" title={TEXT.edit} onPress={() => onEdit(plan)} />
      ) : null}
    </WorkflowCard>
  );
}

export function TrainingPlansSection({ classId, coach }: { classId: string; coach: boolean }) {
  const plans = useTrainingPlans(classId, coach);
  const members = plans.data?.members ?? [];
  const editor = useTrainingPlanEditor(classId, members);

  return (
    <View className="gap-md">
      <View className="flex-row items-center justify-between gap-sm">
        <View className="flex-1 flex-row items-center gap-1.5">
          <Icon name="assignment" size={16} color={Colors.primary} />
          <Text className="text-md font-bevn-bold text-text-primary">{TEXT.title}</Text>
        </View>
        {coach && plans.isSuccess ? <Button size="sm" block={false} icon="add" title={TEXT.create} onPress={editor.openCreate} /> : null}
      </View>
      <WorkflowState
        pending={plans.isPending}
        error={plans.error}
        retry={() => { void plans.refetch(); }}
        empty={plans.isSuccess && !plans.data.plans.length ? TEXT.empty : undefined}
      />
      {plans.data?.plans.map((plan) => <PlanCard key={plan.id} plan={plan} onEdit={coach ? editor.openEdit : undefined} />)}
      {coach ? <TrainingPlanSheet editor={editor} members={members} /> : null}
    </View>
  );
}
