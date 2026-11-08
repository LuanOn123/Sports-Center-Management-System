// app/coach/member/[id].tsx
// Hồ sơ học viên của HLV — UI ở components/coach/LearnerProfileView, logic ở hooks/coach/useLearnerProfile

import { useLocalSearchParams } from 'expo-router';
import { LearnerProfileView } from '../../../components/coach/LearnerProfileView';

export default function LearnerScreen() {
  const { id, scheduleId } = useLocalSearchParams<{ id: string; scheduleId?: string }>();
  return <LearnerProfileView memberId={id} scheduleId={scheduleId || undefined} />;
}
