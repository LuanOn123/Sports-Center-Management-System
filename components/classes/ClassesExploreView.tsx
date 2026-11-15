// components/classes/ClassesExploreView.tsx
// Màn Khám phá (hội viên) / Lớp phụ trách (HLV): tiêu đề → tìm kiếm → hai hàng chip lọc môn tập + hạng lớp (không nhãn)
// → số kết quả → danh sách thẻ lớp (hội viên: bấm cả thẻ để xem chi tiết và đăng ký; HLV: "Chi tiết lớp" / "Xem lịch dạy").

import React, { useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Pressable } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { FacilityPicker } from '../shared/FacilityPicker';
import { FilterChip } from '../shared/FilterChip';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { CoachClassCard } from '../coach/CoachClassCard';
import { TermBanner } from '../member/TermBanner';
import { ClassCard } from './ClassCard';
import { ClassFilterSheet } from './ClassFilterSheet';
import { useClassesExplore } from '../../hooks/shared/useClassesExplore';
import { CLASS_FILTER_TEXT, CLASS_TYPE_FILTERS, CLASS_TYPE_LABEL } from '../../constants/classes';
import { Colors, Spacing } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';

export function ClassesExploreView() {
  const router = useRouter();
  const searchInputRef = useRef<TextInputInstance>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const explore = useClassesExplore();
  const { isCoach, classes } = explore;

  const sportOptions = [{ id: '', name: 'Tất cả' }, ...explore.sports];
  const filterActive = explore.advancedFilterCount > 0;

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Hội viên: tab Khám phá; HLV: màn con "Lớp phụ trách" mở từ Tài khoản / Trang chủ */}
      <ScreenHeader variant={isCoach ? 'stack' : 'tab'} title={isCoach ? 'Lớp phụ trách' : 'Khám phá'} />

      {/* Cơ sở đang xem + kỳ học hiện tại (web: "Cơ sở tìm lớp" và banner kỳ học trên trang Khám phá) */}
      <View className="px-xl pt-md">
        <FacilityPicker />
        {!isCoach && <TermBanner />}
      </View>

      {/* Tìm kiếm */}
      <View className="px-xl mb-md">
        <Pressable
          onPress={() => searchInputRef.current?.focus()}
          className="flex-row items-center bg-bg-surface rounded-lg px-md border border-border"
        >
          <Icon name="search" size={20} color={Colors.text.muted} style={{ marginRight: 4 }} />
          <TextInput
            ref={searchInputRef}
            className="flex-1 py-md text-text-primary text-md font-bevn-regular"
            placeholder={isCoach ? 'Tìm trong lớp bạn phụ trách...' : 'Tìm kiếm lớp học...'}
            placeholderTextColor={Colors.text.muted}
            value={explore.search}
            onChangeText={explore.setSearch}
            returnKeyType="search"
          />
          {Boolean(explore.search) && (
            <TouchableOpacity onPress={() => explore.setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Xóa tìm kiếm">
              <Icon name="close" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </Pressable>
      </View>

      {/* Lọc theo môn tập — chỉ có chip, không có nhãn chữ */}
      <View>
        <FlatList
          horizontal
          accessibilityLabel="Lọc theo môn tập"
          style={{ flexGrow: 0 }}
          data={sportOptions}
          keyExtractor={(s) => s.id || 'all'}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm, paddingBottom: Spacing.md }}
          renderItem={({ item }) => (
            <FilterChip label={item.name} active={(explore.sportId ?? '') === item.id} onPress={() => explore.setSportId(item.id || undefined)} />
          )}
        />
      </View>

      {/* Lọc theo hạng lớp (lớp Cao cấp cần gói Premium) — chỉ có chip, không có nhãn chữ */}
      <View className="flex-row flex-wrap px-xl gap-sm mb-md">
        {CLASS_TYPE_FILTERS.map((type) => (
          <FilterChip key={type ?? 'all'} label={type ? CLASS_TYPE_LABEL[type] : 'Tất cả'} active={explore.classType === type} onPress={() => explore.setClassType(type)} />
        ))}
        {/* Khu vực + kỳ học nằm trong bảng "Bộ lọc" để không chiếm thêm hàng trên màn hình nhỏ (chỉ hội viên, như web) */}
        {!isCoach && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={CLASS_FILTER_TEXT.button}
            className="flex-row items-center gap-1 px-md py-xs rounded-full border"
            style={{ backgroundColor: filterActive ? Colors.primary + '22' : Colors.bg.surface, borderColor: filterActive ? Colors.primary : Colors.border }}
            onPress={() => { Haptic.selection(); setFilterOpen(true); }}
          >
            <Icon name="tune" size={14} color={filterActive ? Colors.primary : Colors.text.secondary} />
            <Text className="text-sm font-bevn-medium" style={{ color: filterActive ? Colors.primary : Colors.text.secondary }}>
              {filterActive ? `${CLASS_FILTER_TEXT.button} · ${explore.advancedFilterCount}` : CLASS_FILTER_TEXT.button}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
          contentContainerStyle={{ padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md }}
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

      {!isCoach && (
        <ClassFilterSheet
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
          areaType={explore.areaType}
          onAreaType={explore.setAreaType}
          terms={explore.terms}
          termId={explore.termId}
          onTerm={explore.setTermId}
          currentTermId={explore.currentTermId}
          activeCount={explore.advancedFilterCount}
          onClear={explore.clearAdvancedFilters}
        />
      )}
    </View>
  );
}
