// app/classes/[id].tsx
// Chi tiết lớp học — UI ở components/classes/ClassDetailView, logic ở hooks/shared/useClassDetail

import { useLocalSearchParams } from 'expo-router';
import { ClassDetailView } from '../../components/classes/ClassDetailView';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClassDetailView id={id} />;
}
