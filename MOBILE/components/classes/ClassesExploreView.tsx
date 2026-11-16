// components/classes/ClassesExploreView.tsx
// Màn Khám phá (hội viên) / Lớp phụ trách (HLV): tiêu đề → cơ sở + kỳ học → MỘT hàng gồm ô tìm kiếm và nút "Bộ lọc"
// (môn tập, hạng lớp, khu vực, kỳ học nằm trong bảng lọc) → chip gỡ nhanh, chỉ hiện khi có bộ lọc đang bật → số kết quả →
// danh sách thẻ lớp (hội viên: bấm cả thẻ để xem chi tiết và đăng ký; HLV: "Chi tiết lớp" / "Xem lịch dạy").

import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { ActiveFilterChips } from '../shared/ActiveFilterChips';
import { FacilityPicker } from '../shared/FacilityPicker';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { CoachClassCard } from '../coach/CoachClassCard';
import { TermBanner } from '../member/TermBanner';
import { ClassCard } from './ClassCard';
import { ClassFilterSheet } from './ClassFilterSheet';
import { ClassSearchBar } from './ClassSearchBar';
import { useClassesExplore } from '../../hooks/shared/useClassesExplore';
import { Colors, Spacing } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';

export function ClassesExploreView() {
  const router = useRouter();
  // HLV: màn đẩy lên trên tabs (không có thanh tab) nên chừa chỗ cho thanh home của máy; hội viên ở tab thì thanh tab đã lo
  const insets = useSafeAreaInsets();
  const [filterOpen, setFilterOpen] = useState(false);
  const explore = useClassesExplore();
  const { isCoach, classes } = explore;

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Hội viên: tab Khám phá; HLV: màn con "Lớp phụ trách" mở từ Tài khoản / Trang chủ */}
      <ScreenHeader variant={isCoach ? 'stack' : 'tab'} title={isCoach ? 'Lớp phụ trách' : 'Khám phá'} />

      {/* Cơ sở đang xem + kỳ học hiện tại (web: "Cơ sở tìm lớp" và banner kỳ học trên trang Khám phá) */}
      <View className="px-xl pt-md">
        <FacilityPicker />
        {!isCoach && <TermBanner />}
      </View>

      {/* Tìm kiếm + nút Bộ lọc: một hàng duy nhất; mọi bộ lọc nằm trong bảng lọc */}
      <ClassSearchBar
        value={explore.search}
        onChange={explore.setSearch}
        placeholder={isCoach ? 'Tìm trong lớp bạn phụ trách...' : 'Tìm kiếm lớp học...'}
        filterCount={explore.filterCount}
        onOpenFilters={() => setFilterOpen(true)}
      />
      <ActiveFilterChips filters={explore.activeFilters} onRemove={explore.clearFilter} />

      {/* Số kết quả */}
      {!explore.isLoading && (
        <View className="flex-row items-center justify-between px-xl">
          <Text className="text-sm text-text-secondary font-bevn-medium">{classes.length} lớp học</Text>
          {explore.hasFilters && (
            <TouchableOpacity onPress={() => { Haptic.selection(); explore.clearFilters(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-sm text-primary font-bevn-semibold">Xóa bộ lọc</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Danh sách lớp */}
      {explore.isLoading ? (
        <View className="px-xl pt-md">
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xl + (isCoach ? insets.bottom : 0), gap: Spacing.md }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { Haptic.light(); void explore.refresh(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px]">
              <Icon name="fitness-center" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-sm text-text-muted font-bevn-regular">
                {isCoach ? 'Bạn chưa được phân công lớp nào phù hợp' : 'Không tìm thấy lớp học phù hợp'}
              </Text>
            </View>
          }
          ListFooterComponent={
            classes.length > 0 ? (
              <Text className="text-xs text-text-muted font-bevn-regular text-center mt-sm">Đã hiển thị tất cả {classes.length} lớp</Text>
            ) : undefined
          }
          renderItem={({ item }) => isCoach ? (
            // HLV: thẻ riêng (hạng lớp, sức chứa, trạng thái + lối tới lịch dạy của lớp), không tải chỗ trống / kỳ đăng ký của hội viên
            <CoachClassCard
              item={item}
              onOpenDetail={() => { Haptic.light(); router.push(ROUTES.classDetail(item.id)); }}
              onOpenSchedule={() => { Haptic.light(); router.push(ROUTES.coachScheduleFor(item.id)); }}
            />
          ) : (
            <ClassCard
              item={item}
              onPress={() => {
                Haptic.light();
                router.push(ROUTES.classDetail(item.id));
              }}
            />
          )}
        />
      )}

      {/* Khu vực + kỳ học chỉ có ở hội viên (như web); môn tập và hạng lớp dùng cho cả hai vai trò */}
      <ClassFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        sports={explore.sports}
        sportId={explore.sportId}
        onSport={explore.setSportId}
        classType={explore.classType}
        onClassType={explore.setClassType}
        showRegistrationFilters={!isCoach}
        areaType={explore.areaType}
        onAreaType={explore.setAreaType}
        terms={explore.terms}
        termId={explore.termId}
        onTerm={explore.setTermId}
        currentTermId={explore.currentTermId}
        activeCount={explore.filterCount}
        onClear={explore.clearSelectedFilters}
        resultCount={explore.isLoading ? undefined : classes.length}
      />
    </View>
  );
}
