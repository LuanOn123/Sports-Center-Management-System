// components/classes/ClassesExploreView.tsx
// Màn Khám phá (hội viên) / Lớp dạy (HLV): tiêu đề → tìm kiếm → lọc "Môn tập" + "Hạng lớp" (có nhãn)
// → số kết quả → danh sách thẻ lớp (bấm cả thẻ để xem chi tiết và đăng ký).

import React, { useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { FilterChip } from '../shared/FilterChip';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { ClassCard } from './ClassCard';
import { useClassesExplore } from '../../hooks/shared/useClassesExplore';
import { CLASS_TYPE_FILTERS, CLASS_TYPE_LABEL } from '../../constants/classes';
import { Colors, Spacing } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';

function FilterLabel({ children }: { children: string }) {
  return <Text className="text-xs text-text-muted font-bevn-medium px-xl mb-xs">{children}</Text>;
}

export function ClassesExploreView() {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const explore = useClassesExplore();
  const { isCoach, classes } = explore;

  const sportOptions = [{ id: '', name: 'Tất cả' }, ...explore.sports];

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title={isCoach ? 'Lớp dạy' : 'Khám phá'}
        subtitle={isCoach ? 'Các lớp bạn đang phụ trách' : 'Tìm và đăng ký lớp tập phù hợp'}
      />

      {/* Tìm kiếm */}
      <View className="px-xl pt-xl mb-md">
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

      {/* Lọc theo môn tập */}
      <FilterLabel>Môn tập</FilterLabel>
      <View>
        <FlatList
          horizontal
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

      {/* Lọc theo hạng lớp (lớp Cao cấp cần gói Premium) */}
      <FilterLabel>Hạng lớp</FilterLabel>
      <View className="flex-row flex-wrap px-xl gap-sm mb-md">
        {CLASS_TYPE_FILTERS.map((type) => (
          <FilterChip key={type ?? 'all'} label={type ? CLASS_TYPE_LABEL[type] : 'Tất cả'} active={explore.classType === type} onPress={() => explore.setClassType(type)} />
        ))}
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
            ) : null
          }
          renderItem={({ item }) => (
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
    </View>
  );
}
