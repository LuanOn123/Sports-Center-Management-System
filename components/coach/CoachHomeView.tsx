// components/coach/CoachHomeView.tsx
// Trang chủ Huấn luyện viên: lời chào + chuyên môn, chỉ số nhanh, buổi dạy tiếp theo (điểm danh khi tới giờ),
// lối tắt, tổng quan tuần dạy, lịch dạy sắp tới. Logic ở hooks/coach/useCoachHome.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { Brand } from '../shared/Brand';
import { FacilityPicker } from '../shared/FacilityPicker';
import { NotificationBell } from '../shared/NotificationBell';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { Button, Card, EmptyState, SectionHeader, ShortcutRow, StatTile } from '../ui';
import { WeeklyTeachingSummary } from './WeeklyTeachingSummary';
import { getQuickAccessForRole } from '../../navigation/quickAccessConfig';
import { useCoachHome } from '../../hooks/coach/useCoachHome';
import { Colors, Spacing } from '../../constants/theme';
import { canTakeAttendance } from '../../lib/businessRules';
import { formatStartsIn, formatTime, formatWeekdayDate, greetingFor } from '../../lib/format';
import type { User } from '../../lib/types';
import { ROUTES } from '../../navigation/routes';

/** Số buổi dạy sắp tới hiện dưới thẻ "Buổi dạy tiếp theo" */
const UPCOMING_PREVIEW = 4;

export function CoachHomeView({ user }: { user: User | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const coachId = user?.coachProfile?.id;
  const { coachClasses, teachingSchedules, isLoading, onRefresh } = useCoachHome(coachId);
  const [next, ...later] = teachingSchedules;

  return (
    <ScrollView
      className="flex-1 bg-bg-primary"
      contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: Spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <View className="flex-row justify-between items-center mb-lg">
        <Brand size="sm" align="flex-start" />
        <View className="flex-row items-center gap-sm">
          <NotificationBell />
          <TouchableOpacity onPress={() => router.push(ROUTES.account)} activeOpacity={0.7} accessibilityLabel="Tài khoản">
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size={40} />
          </TouchableOpacity>
        </View>
      </View>

      <FacilityPicker />

      <View className="mb-lg">
        <Text className="text-xxl font-bevn-bold text-text-primary" numberOfLines={1}>{greetingFor()}, HLV {user?.fullName?.split(' ').pop()}</Text>
        <Text className="text-sm text-text-secondary font-bevn-regular mt-0.5" numberOfLines={1}>
          {user?.coachProfile?.specialization ? `Chuyên môn: ${user.coachProfile.specialization}` : formatWeekdayDate(new Date().toISOString(), 'long')}
        </Text>
      </View>

      <View className="flex-row gap-sm mb-lg">
        <StatTile label="Lớp phụ trách" value={coachClasses.length} color={Colors.primary} />
        <StatTile label="Buổi sắp tới" value={teachingSchedules.length} color={Colors.status.scheduled} />
        {Boolean(user?.coachProfile?.experienceYears) && <StatTile label="Năm kinh nghiệm" value={user!.coachProfile!.experienceYears!} color={Colors.tier.PREMIUM} />}
      </View>

      {isLoading ? (
        <View className="mb-lg"><ClassCardSkeleton /></View>
      ) : !next ? (
        <View className="mb-lg">
          <EmptyState icon="event-available" title="Chưa có buổi dạy sắp tới" actionLabel="Xem lớp phụ trách" onAction={() => router.push(ROUTES.classes)} />
        </View>
      ) : (
        <Card accent={Colors.primary} className="mb-lg" onPress={() => router.push(ROUTES.scheduleDetail(next.id))}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-text-muted font-bevn-semibold uppercase tracking-wide">Buổi dạy tiếp theo</Text>
            <Text className="text-xs text-primary font-bevn-semibold">{formatStartsIn(next.startTime, next.endTime)}</Text>
          </View>
          <Text className="text-xl font-bevn-bold text-text-primary mt-xs" numberOfLines={1}>{next.class?.name ?? 'Lớp học'}</Text>
          <View className="flex-row items-center gap-md mt-xs mb-md">
            <Text className="text-sm text-text-secondary font-bevn-regular">{formatTime(next.startTime)}–{formatTime(next.endTime)}</Text>
            {Boolean(next.room) && <Text className="flex-1 text-sm text-text-secondary font-bevn-regular" numberOfLines={1}>{next.room!.name}</Text>}
            <View className="flex-row items-center gap-1">
              <Icon name="people" size={15} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">{next._count?.enrollments ?? 0}{next.class?.capacity ? `/${next.class.capacity}` : ''}</Text>
            </View>
          </View>
          {canTakeAttendance(next) ? (
            <Button title="Điểm danh học viên" icon="check-circle" onPress={() => router.push(ROUTES.coachAttendanceFor(next.id))} />
          ) : (
            <Button title="Xem buổi dạy" variant="secondary" onPress={() => router.push(ROUTES.scheduleDetail(next.id))} />
          )}
        </Card>
      )}

      <ShortcutRow items={getQuickAccessForRole('COACH')} />

      {coachId && <WeeklyTeachingSummary coachId={coachId} />}

      {later.length > 0 && (
        <View className="mb-lg">
          <SectionHeader title="Lịch dạy sắp tới" actionLabel="Lịch dạy" onAction={() => router.push(ROUTES.schedule)} />
          <View className="gap-sm">
            {later.slice(0, UPCOMING_PREVIEW).map((s) => (
              <Card key={s.id} onPress={() => router.push(ROUTES.scheduleDetail(s.id))}>
                <View className="flex-row items-center gap-md">
                  <View className="items-center w-14">
                    <Text className="text-md font-bevn-bold text-text-primary">{formatTime(s.startTime)}</Text>
                    <Text className="text-xs text-text-muted font-bevn-regular">{formatWeekdayDate(s.startTime).split(',')[0]}</Text>
                  </View>
                  <View className="flex-1 border-l-2 pl-md" style={{ borderLeftColor: Colors.primary }}>
                    <Text className="text-md font-bevn-semibold text-text-primary" numberOfLines={1}>{s.class?.name ?? 'Lớp học'}</Text>
                    <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>
                      {formatWeekdayDate(s.startTime)}{s.room ? ` · ${s.room.name}` : ''} · {s._count?.enrollments ?? 0} học viên
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={Colors.text.muted} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
