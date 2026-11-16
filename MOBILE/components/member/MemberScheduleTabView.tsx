// components/member/MemberScheduleTabView.tsx
// Tab "Lịch" của hội viên: một header + bộ chuyển "Lịch tập" / "Lớp của tôi".
// Hai phần giữ nguyên logic của web: SchedulePage (lịch theo tuần / tháng) và MyClassesPage (lớp đã đặt: Sắp tới | Hoàn thành |
// Đã hủy, chỉ xem lớp — hội viên không tự hủy hay đổi buổi, cần hỗ trợ lịch thì liên hệ lễ tân).

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ScreenHeader } from '../shared/ScreenHeader';
import { Segmented } from '../ui';
import { MemberScheduleView } from './MemberScheduleView';
import { MyClassesView } from './enrollments/MyClassesView';

export type MemberScheduleSegment = 'week' | 'classes';

const SEGMENTS: { value: MemberScheduleSegment; label: string }[] = [
  { value: 'week', label: 'Lịch tập' },
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
      <ScreenHeader variant="tab" title="Lịch tập" />
      <View className="px-xl pb-sm">
        <Segmented options={SEGMENTS} value={segment} onChange={setSegment} />
      </View>
      {segment === 'week' ? <MemberScheduleView embedded /> : <MyClassesView embedded />}
    </View>
  );
}
