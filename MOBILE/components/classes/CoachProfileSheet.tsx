// components/classes/CoachProfileSheet.tsx
// Hồ sơ huấn luyện viên (web: CoachProfileDialog): ảnh + tên + vai trò trong lớp, chuyên môn, kinh nghiệm, giới thiệu,
// rồi đánh giá của học viên (hội viên đủ điều kiện gửi/sửa đánh giá ngay tại đây — logic ở components/shared/CoachRating).
// Mở ra là có nội dung ngay từ dữ liệu của lớp; ảnh và giới thiệu mới nhất thay vào khi tải xong.

import React, { useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { CoachRating } from '../shared/CoachRating';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { WorkflowState } from '../shared/WorkflowScreen';
import { useCoachProfile } from '../../hooks/shared/useCoachProfile';
import { COACH_PROFILE_TEXT as T } from '../../constants/coachProfile';
import { Colors, Spacing } from '../../constants/theme';
import type { ClassCoach } from '../../lib/types';

function Fact({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View className="bg-bg-elevated rounded-lg p-md gap-xs">
      <View className="flex-row items-center gap-1.5">
        <Icon name={icon} size={16} color={Colors.primary} />
        <Text className="text-sm text-text-primary font-bevn-bold">{title}</Text>
      </View>
      {children}
    </View>
  );
}

const bodyText = 'text-sm text-text-secondary font-bevn-regular leading-[22px]';

export function CoachProfileSheet({ assigned, classId, onClose }: { assigned: ClassCoach | null; classId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  // Giữ nội dung của HLV vừa xem cho tới khi bảng trượt xuống xong (không để trống giữa chừng lúc đóng)
  const lastAssigned = useRef<ClassCoach | null>(null);
  if (assigned) lastAssigned.current = assigned;
  const shown = assigned ?? lastAssigned.current;
  const profile = useCoachProfile(shown);
  const view = profile.view;

  return (
    <Modal visible={Boolean(assigned)} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAwareView>
        <TouchableOpacity className="flex-1 bg-overlay justify-end" activeOpacity={1} onPress={onClose}>
          <TouchableOpacity
            activeOpacity={1}
            className="bg-bg-surface rounded-t-xl border-t border-border pt-xl"
            style={{ maxHeight: '92%', paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
          >
            <View className="flex-row items-center px-xl mb-md">
              <Text className="flex-1 text-lg font-bevn-bold text-text-primary mr-sm">{T.sheetTitle}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng" onPress={onClose} hitSlop={12}>
                <Icon name="close" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {view && shown && (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md }}>
                <View className="flex-row items-center gap-md">
                  <Avatar uri={view.avatarUrl} name={view.name} size={72} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-xs text-primary font-bevn-bold tracking-wide">{T.eyebrow}</Text>
                    <Text className="text-xl text-text-primary font-bevn-bold">{view.name}</Text>
                    <Text className="text-sm text-text-secondary font-bevn-regular">{view.roleLine}</Text>
                  </View>
                  {profile.loading && <ActivityIndicator size="small" color={Colors.primary} />}
                </View>

                <WorkflowState error={profile.error} retry={() => { void profile.refetch(); }} />

                <Fact icon="fitness-center" title={T.specialtyTitle}>
                  {view.specialties.length ? (
                    <View className="flex-row flex-wrap gap-xs">
                      {view.specialties.map((name) => (
                        <View key={name} className="rounded-full px-sm py-0.5 bg-bg-surface border border-border">
                          <Text className="text-xs text-text-primary font-bevn-medium">{name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className={bodyText}>{T.noSpecialty}</Text>
                  )}
                </Fact>
                <Fact icon="workspace-premium" title={T.experienceTitle}>
                  <Text className={bodyText}>{view.experience}</Text>
                </Fact>
                <Fact icon="person" title={T.bioTitle}>
                  <Text className={bodyText}>{view.bio}</Text>
                </Fact>

                <CoachRating coachId={shown.coachId} coachName={view.name} classId={classId} title={T.reviewsTitle} />
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareView>
    </Modal>
  );
}
