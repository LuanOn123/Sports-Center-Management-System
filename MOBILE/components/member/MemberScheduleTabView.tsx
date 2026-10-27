// components/member/MemberScheduleTabView.tsx
// Tab "Lịch" của hội viên: một header + bộ chuyển "Lịch học" / "Lớp của tôi".
// Hai phần giữ nguyên logic của web: SchedulePage (lịch theo tuần / tháng) và MyClassesPage (lớp đã đặt, đổi buổi, hủy).

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ScreenHeader } from '../shared/ScreenHeader';
import { Segmented } from '../ui';
import { MemberScheduleView } from './MemberScheduleView';
import { MyClassesView } from './enrollments/MyClassesView';

export type MemberScheduleSegment = 'week' | 'classes';

const SEGMENTS: { value: MemberScheduleSegment; label: string }[] = [
  { value: 'week', label: 'Lịch học' },
  { value: 'classes', label: 'Lớp của tôi' },
];

export function MemberScheduleTabView({ initial }: { initial?: MemberScheduleSegment }) {
  const [segment, setSegment] = useState<MemberScheduleSegment>(initial === 'classes' ? 'classes' : 'week');
  // Mở lại tab bằng ROUTES.myClasses khi đang ở tab → chuyển đúng phần
  useEffect(() => {
    if (initial === 'classes' || initial === 'week') setSegment(initial);
  }, [initial]);

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader variant="tab" title="Lịch học" />
      <View className="px-xl pb-sm">
        <Segmented options={SEGMENTS} value={segment} onChange={setSegment} />
      </View>
      {segment === 'week' ? <MemberScheduleView embedded /> : <MyClassesView embedded />}
    </View>
  );
}
