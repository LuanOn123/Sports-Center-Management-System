// components/classes/ClassCard.tsx
// Thẻ lớp trên màn Khám phá — giống thẻ lớp web (BrowseClassesPage): môn, hạng, tên, mô tả, HLV,
// lịch học trong tuần + tình trạng chỗ trống (từ course-plan). Cả thẻ bấm được để xem chi tiết.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';
import { CLASS_CARD_SLOT_PREVIEW, CLASS_TYPE_COLOR, CLASS_TYPE_LABEL, LOW_SLOT_THRESHOLD } from '../../constants/classes';
import { useCoursePlan } from '../../hooks/shared/useClasses';
import { courseAvailability, formatSlot, previewSlots, type AvailabilityTone } from '../../lib/classPlan';
import { termTag } from '../../lib/termRegistration';
import { TERM_NOTICE_COLOR } from '../../constants/terms';
import type { Class } from '../../lib/types';

const TONE_COLOR: Record<AvailabilityTone, string> = {
  open: Colors.status.success,
  limited: Colors.status.pending,
  full: Colors.status.failed,
};

function MetaRow({ icon, color = Colors.text.muted, children }: { icon: string; color?: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-1.5">
      <Icon name={icon} size={14} color={color} style={{ marginTop: 2 }} />
      <View className="flex-1">{children}</View>
    </View>
  );
}

export function ClassCard({ item, onPress }: { item: Class; onPress: () => void }) {
  const plan = useCoursePlan(item.id);
  const course = plan.data?.data.course;
  const slots = previewSlots(course?.slots, CLASS_CARD_SLOT_PREVIEW);
  const availability = course ? courseAvailability(course, LOW_SLOT_THRESHOLD) : null;
  const coachNames = item.coaches?.map((c) => c.coach?.user?.fullName).filter(Boolean).join(', ');
  const typeColor = CLASS_TYPE_COLOR[item.classType];
  // Kỳ học của chính lớp này (web: "📅 Kỳ …" trên thẻ lớp) — thay cho thẻ kỳ học đứng riêng ở đầu danh sách
  const term = course?.term ? termTag(course.term) : null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Xem lớp ${item.name}`}
      className="bg-bg-surface rounded-xl p-lg border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center justify-between mb-xs">
        <Text className="flex-1 text-xs text-primary font-bevn-semibold mr-sm" numberOfLines={1}>
          {item.sports?.map((s) => s.name).join(' · ') || 'Lớp học'}
        </Text>
        <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: typeColor + '20' }}>
          <Text className="text-xs font-bevn-semibold" style={{ color: typeColor }}>{CLASS_TYPE_LABEL[item.classType]}</Text>
        </View>
      </View>

      <Text className="text-lg font-bevn-bold text-text-primary">{item.name}</Text>
      {Boolean(item.description) && (
        <Text className="text-sm text-text-muted font-bevn-regular mt-xs" numberOfLines={2}>{item.description}</Text>
      )}

      <View className="gap-sm mt-md pt-md border-t border-border">
        {term && (
          <MetaRow icon="event-note" color={TERM_NOTICE_COLOR[term.tone]}>
            <Text className="text-sm text-text-secondary font-bevn-regular" numberOfLines={2}>
              <Text className="text-text-primary font-bevn-semibold">{term.name}</Text>
              {' · '}
              <Text className="font-bevn-medium" style={{ color: TERM_NOTICE_COLOR[term.tone] }}>{term.label}</Text>
            </Text>
          </MetaRow>
        )}
        <MetaRow icon="calendar-today">
          {plan.isPending ? (
            <Text className="text-sm text-text-muted font-bevn-regular">Đang tải lịch học…</Text>
          ) : plan.isError ? (
            <Text className="text-sm text-text-muted font-bevn-regular">Không tải được lịch học · kéo xuống để thử lại</Text>
          ) : !course ? (
            <Text className="text-sm text-text-muted font-bevn-regular">Chưa có lịch học sắp tới</Text>
          ) : (
            <>
              {slots.shown.map((slot) => (
                <Text key={`${slot.weekday}-${slot.startTime}-${slot.roomId}`} className="text-sm text-text-secondary font-bevn-medium">{formatSlot(slot)}</Text>
              ))}
              {slots.hiddenCount > 0 && <Text className="text-xs text-text-muted font-bevn-regular">+{slots.hiddenCount} khung giờ khác</Text>}
            </>
          )}
        </MetaRow>
        {availability && (
          <MetaRow icon="group" color={TONE_COLOR[availability.tone]}>
            <Text className="text-sm font-bevn-medium" style={{ color: TONE_COLOR[availability.tone] }}>
              {availability.text}
              <Text className="text-text-muted font-bevn-regular">{` · tối đa ${item.capacity} học viên/buổi`}</Text>
            </Text>
          </MetaRow>
        )}
        {Boolean(coachNames) && (
          <MetaRow icon="person">
            <Text className="text-sm text-text-secondary font-bevn-regular" numberOfLines={1}>HLV {coachNames}</Text>
          </MetaRow>
        )}
      </View>

      <View className="flex-row items-center justify-end gap-1 mt-md">
        <Text className="text-sm text-primary font-bevn-semibold">Xem lớp</Text>
        <Icon name="chevron-right" size={16} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
}
