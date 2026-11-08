// components/coach/LearnerProfileView.tsx
// Hồ sơ học viên cho HLV (web: StudentDetails): cảnh báo y tế, thông tin liên hệ, trình độ, mục tiêu tập luyện
// và mục tiêu/tiến độ của khóa. Chỉ hiện dữ liệu BE thật sự trả cho HLV (hồ sơ rút gọn + danh sách học viên của buổi).

import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../shared/Avatar';
import { GoalProgressBar } from '../shared/GoalProgressBar';
import { InfoBanner } from '../shared/InfoBanner';
import { InfoRow } from '../shared/InfoRow';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowState } from '../shared/WorkflowScreen';
import { useLearnerProfile } from '../../hooks/coach/useLearnerProfile';
import { DEFAULT_GOAL_LABEL, GOAL_TEXT as TEXT } from '../../constants/goals';
import { TRAINING_LEVEL_LABEL } from '../../constants/profile';

interface LearnerProfileViewProps {
  memberId: string;
  /** Buổi dạy mở hồ sơ từ danh sách điểm danh — có thì hiện liên hệ, lưu ý sức khỏe và tiến độ của buổi đó */
  scheduleId?: string;
}

export function LearnerProfileView({ memberId, scheduleId }: LearnerProfileViewProps) {
  const d = useLearnerProfile(memberId, scheduleId);
  const { learner } = d;
  const level = learner?.trainingLevel ? TRAINING_LEVEL_LABEL[learner.trainingLevel] : undefined;

  return (
    <WorkflowScreen title="Hồ sơ học viên" refreshing={d.refreshing} onRefresh={d.refresh}>
      <WorkflowState pending={d.profile.isPending} error={d.profile.error} retry={() => { void d.profile.refetch(); }} />
      {learner && (
        <>
          {Boolean(d.healthNotes) && <InfoBanner tone="warning" title={TEXT.healthTitle} message={d.healthNotes} />}

          <WorkflowCard>
            <View className="flex-row items-center gap-md mb-xs">
              <Avatar uri={learner.user?.avatarUrl} name={learner.user?.fullName} size={48} />
              <Text className="flex-1 text-md font-bevn-bold text-text-primary">{learner.user?.fullName || 'Học viên'}</Text>
            </View>
            {Boolean(d.email) && <InfoRow label="Email" value={d.email!} />}
            {Boolean(d.phone) && <InfoRow label="Điện thoại" value={d.phone!} />}
            <InfoRow label="Trình độ" value={level || 'Chưa cập nhật'} />
          </WorkflowCard>

          <WorkflowCard title={TEXT.learnerGoalHeading}>
            <WorkflowText>{learner.fitnessGoal?.trim() || 'Chưa cập nhật'}</WorkflowText>
          </WorkflowCard>

          {d.courseGoal && (
            <WorkflowCard title={TEXT.courseGoalHeading}>
              <WorkflowText>{d.courseGoal.goal || DEFAULT_GOAL_LABEL}</WorkflowText>
              <GoalProgressBar progress={d.courseGoal.currentProgress} showLegend />
            </WorkflowCard>
          )}
        </>
      )}
    </WorkflowScreen>
  );
}
