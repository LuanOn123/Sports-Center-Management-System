import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { useClasses, useSports } from '../../hooks/shared/useClasses';
import type { ClassFilters } from '../../services/classService';
import { Colors } from '../../constants/theme';

const TYPE_LABEL: Record<string, string> = { REGULAR: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };

export default function ClassesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isCoach = user?.role === 'COACH';
  const coachId = user?.coachProfile?.id;
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | undefined>();
  const [selectedType, setSelectedType] = useState<string | undefined>();

  // ─── Hooks (logic) ──────────────────────────────────────────────────────────
  const { data: sportsData } = useSports();
  const filters: ClassFilters = {
    search: search || undefined,
    sportId: selectedSport,
    classType: selectedType,
    // Coach chỉ xem lớp mình phụ trách — không phải toàn bộ lớp của trung tâm
    coachId: isCoach ? coachId : undefined,
  };
  const { data, isLoading, refetch } = useClasses(filters, { enabled: !isCoach || Boolean(coachId) });

  const sports = sportsData?.data ?? [];
  const classes = data?.data ?? [];

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className="p-xl pb-md">
        <Text className="text-xxl font-bold font-bevn-bold text-text-primary">{isCoach ? 'Lớp dạy' : 'Lớp học'}</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">
          {isCoach ? 'Các lớp bạn đang phụ trách' : 'Khám phá các lớp tập phù hợp'}
        </Text>
      </View>

      {/* Search */}
      <View className="px-xl mb-sm">
        <View className="flex-row items-center bg-bg-surface rounded-lg px-md border border-border">
          <Icon name="search" size={20} color={Colors.text.muted} style={{ marginRight: 4 }} />
          <TextInput
            className="flex-1 py-md text-text-primary text-md font-bevn-regular"
            placeholder={isCoach ? 'Tìm trong lớp bạn phụ trách...' : 'Tìm kiếm lớp học...'}
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Sport filter */}
      <View>
        <FlatList
          horizontal
          data={[{ id: '', name: 'Tất cả' }, ...sports]}
          keyExtractor={(s) => s.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={clsx(
                'px-lg py-xs rounded-full border',
                selectedSport === item.id ? 'bg-primary border-primary' : 'bg-bg-surface border-border'
              )}
              onPress={() => setSelectedSport(item.id || undefined)}
            >
              <Text className={clsx('text-sm font-bevn-medium', selectedSport === item.id ? 'text-text-inverse font-bold' : 'text-text-secondary')}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Class type filter */}
      <View className="flex-row px-xl gap-sm mb-md">
        {[undefined, 'REGULAR', 'PREMIUM'].map((type) => (
          <TouchableOpacity
            key={type ?? 'all'}
            className={clsx(
              'flex-1 py-xs rounded-md items-center border',
              selectedType === type ? 'bg-[#A3E63520] border-primary' : 'bg-bg-surface border-border'
            )}
            onPress={() => setSelectedType(type)}
          >
            <Text className={clsx('text-xs font-bevn-medium', selectedType === type ? 'text-primary font-semibold' : 'text-text-secondary')}>
              {type ? TYPE_LABEL[type] : 'Tất cả'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Classes list */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px]">
              <Icon name="fitness-center" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-sm text-text-muted font-bevn-regular">
                {isCoach ? 'Bạn chưa được phân công lớp nào phù hợp' : 'Không tìm thấy lớp học phù hợp'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-bg-surface rounded-xl p-lg border border-border"
              onPress={() => router.push(`/classes/${item.id}`)}
              activeOpacity={0.8}
            >
              <View className="mb-md">
                <View className="flex-row justify-between items-start mb-xs">
                  <Text className="flex-1 text-lg font-bold font-bevn-bold text-text-primary mr-sm">{item.name}</Text>
                  <View className={clsx('rounded-full px-sm py-0.5', item.classType === 'PREMIUM' ? 'bg-[#F59E0B20]' : 'bg-[#3B82F620]')}>
                    <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">{TYPE_LABEL[item.classType]}</Text>
                  </View>
                </View>
                {Boolean(item.sports?.length) && (
                  <View className="flex-row items-center gap-1 mb-xs">
                    <Icon name="sports" size={14} color={Colors.primary} />
                    <Text className="text-sm text-text-secondary font-bevn-regular">{item.sports!.map((s) => s.name).join(', ')}</Text>
                  </View>
                )}
                {Boolean(item.description) && (
                  <Text className="text-sm text-text-muted font-bevn-regular" numberOfLines={2}>{item.description}</Text>
                )}
              </View>
              <View className="flex-row items-center gap-md">
                <View className="flex-row items-center gap-1">
                  <Icon name="group" size={14} color={Colors.text.muted} />
                  <Text className="text-xs text-text-muted font-bevn-regular">Sĩ số: {item.capacity}</Text>
                </View>
                {Boolean(item.coaches && item.coaches.length > 0) && (
                  <View className="flex-row items-center gap-1">
                    <Icon name="person" size={14} color={Colors.text.muted} />
                    <Text className="text-xs text-text-muted font-bevn-regular">{item.coaches!.length} HLV</Text>
                  </View>
                )}
                <Icon name="chevron-right" size={22} color={Colors.primary} style={{ marginLeft: 'auto' }} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
