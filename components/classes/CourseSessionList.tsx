// components/classes/CourseSessionList.tsx
// "Các buổi của khóa" ở chi tiết lớp — CHỈ XEM (đăng ký theo cả khóa ở nút dưới đáy, giống web).
// Hiện gọn trong khung cao vừa đúng COURSE_SESSION_LIST.visibleRows buổi, các buổi còn lại kéo xuống ngay trong khung
// nên trang không dài ra. Buổi đã đặt bấm để mở chi tiết buổi; thao tác duy nhất theo buổi: vào danh sách chờ khi buổi hết chỗ.

import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import { WaitlistAction } from '../member/WaitlistAction';
import { StatusBadge } from '../ui';
import { useFramedRows } from '../../hooks/shared/useFramedRows';
import { COURSE_SESSION_LIST, SESSION_TONE_COLOR } from '../../constants/classes';
import { canJoinSessionWaitlist, sessionStatusLabel } from '../../lib/classPlan';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import type { CoursePlan } from '../../lib/types';

type CourseSession = CoursePlan['sessions'][number];

interface CourseSessionListProps {
  sessions: CourseSession[];
  /** Sức chứa mỗi buổi — dòng "còn x/y chỗ" */
  capacity: number;
  onOpenSession: (sessionId: string) => void;
}

function SessionRow({ session, capacity, first, onOpen, onLayout }: {
  session: CourseSession; capacity: number; first: boolean; onOpen: (sessionId: string) => void; onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const label = sessionStatusLabel(session);
  const row = (
    <View className={first ? 'px-lg py-md' : 'px-lg py-md border-t border-divider'}>
      <View className="flex-row items-center gap-md">
        <View className="flex-1">
          <Text className="text-sm text-text-primary font-bevn-semibold">{formatWeekdayDate(session.startTime)} · {formatTime(session.startTime)}–{formatTime(session.endTime)}</Text>
          <Text className="text-xs text-text-muted font-bevn-regular mt-0.5" numberOfLines={1}>
            {session.room?.name || 'Phòng tập'}{session.isFull ? '' : ` · còn ${session.remainingSlots}/${capacity} chỗ`}
          </Text>
        </View>
        <StatusBadge label={label.text} color={SESSION_TONE_COLOR[label.tone]} />
      </View>
      {canJoinSessionWaitlist(session) && <View className="mt-sm"><WaitlistAction scheduleId={session.id} /></View>}
    </View>
  );
  return session.myEnrollmentStatus === 'BOOKED'
    ? <TouchableOpacity onPress={() => onOpen(session.id)} activeOpacity={0.7} onLayout={onLayout}>{row}</TouchableOpacity>
    : <View onLayout={onLayout}>{row}</View>;
}

export function CourseSessionList({ sessions, capacity, onOpenSession }: CourseSessionListProps) {
  const { visibleRows, estimatedRowHeight, moreHint } = COURSE_SESSION_LIST;
  const scrolls = sessions.length > visibleRows;
  const { frameHeight, onRowLayout } = useFramedRows(visibleRows, estimatedRowHeight);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // iOS chỉ hiện thanh cuộn khi đang cuộn: nháy một lần để người dùng biết khung kéo được
  useEffect(() => {
    if (scrolls) scrollRef.current?.flashScrollIndicators?.();
  }, [scrolls]);

  const rows = sessions.map((session, index) => (
    <SessionRow
      key={session.id}
      session={session}
      capacity={capacity}
      first={index === 0}
      onOpen={onOpenSession}
      onLayout={scrolls ? (event) => onRowLayout(index, event.nativeEvent.layout.height) : undefined}
    />
  ));

  return (
    <View>
      <View className="bg-bg-surface rounded-lg border border-border overflow-hidden">
        {scrolls ? (
          <ScrollView
            ref={scrollRef}
            nestedScrollEnabled
            persistentScrollbar
            showsVerticalScrollIndicator
            style={{ height: frameHeight }}
            accessibilityLabel={`Các buổi của khóa, ${sessions.length} buổi`}
          >
            {rows}
          </ScrollView>
        ) : rows}
      </View>
      {scrolls && <Text className="text-xs text-text-muted font-bevn-regular text-center mt-xs">{moreHint(sessions.length)}</Text>}
    </View>
  );
}
