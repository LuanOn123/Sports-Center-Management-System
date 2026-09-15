import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import type { Class, Sport } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const TYPE_LABEL: Record<string, string> = { REGULAR: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };

export default function ClassesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | undefined>();
  const [selectedType, setSelectedType] = useState<string | undefined>();

  const { data: sportsData } = useQuery({
    queryKey: ['sports-list'],
    queryFn: () => api.publicGet<Sport[]>('/sports', { isActive: 'true', limit: '50' }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['classes', search, selectedSport, selectedType],
    queryFn: () =>
      api.get<Class[]>('/classes', {
        search: search || undefined,
        sportId: selectedSport,
        classType: selectedType,
        isActive: 'true',
        limit: '20',
      }),
    placeholderData: (prev) => prev,
  });

  const sports = sportsData?.data ?? [];
  const classes = data?.data ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lớp Học</Text>
        <Text style={styles.headerSub}>Khám phá các lớp tập phù hợp</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={Colors.text.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.search}
            placeholder="Tìm kiếm lớp học..."
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
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selectedSport === item.id && styles.chipActive]}
              onPress={() => setSelectedSport(item.id || undefined)}
            >
              <Text style={[styles.chipText, selectedSport === item.id && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Class type filter */}
      <View style={styles.typeRow}>
        {[undefined, 'REGULAR', 'PREMIUM'].map((type) => (
          <TouchableOpacity
            key={type ?? 'all'}
            style={[styles.typeBtn, selectedType === type && styles.typeBtnActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[styles.typeBtnText, selectedType === type && styles.typeBtnTextActive]}>
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
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="fitness-center" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyText}>Không tìm thấy lớp học phù hợp</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/classes/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={[styles.typeBadge, item.classType === 'PREMIUM' ? styles.typePremium : styles.typeRegular]}>
                    <Text style={styles.typeBadgeText}>{TYPE_LABEL[item.classType]}</Text>
                  </View>
                </View>
                {Boolean(item.sport) && (
                  <View style={styles.cardSportRow}>
                    <MaterialIcons name="sports" size={14} color={Colors.primary} />
                    <Text style={styles.cardSport}>{item.sport!.name}</Text>
                  </View>
                )}
                {Boolean(item.description) && (
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                )}
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.cardInfoItem}>
                  <MaterialIcons name="group" size={14} color={Colors.text.muted} />
                  <Text style={styles.cardInfo}>Sĩ số: {item.capacity}</Text>
                </View>
                {Boolean(item.coaches && item.coaches.length > 0) && (
                  <View style={styles.cardInfoItem}>
                    <MaterialIcons name="person" size={14} color={Colors.text.muted} />
                    <Text style={styles.cardInfo}>{item.coaches!.length} HLV</Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={22} color={Colors.primary} style={{ marginLeft: 'auto' }} />
              </View>

            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  searchRow: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { marginRight: Spacing.xs },
  search: {
    flex: 1, paddingVertical: Spacing.md,
    color: Colors.text.primary, fontSize: FontSize.md,
    fontFamily: 'BeVietnamPro_400Regular',
  },
  filterList: { paddingHorizontal: Spacing.xl, gap: Spacing.sm, paddingBottom: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  chipTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold },
  typeRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: { flex: 1, paddingVertical: Spacing.xs, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  typeBtnText: { fontSize: FontSize.xs, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  typeBtnTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.xl, gap: Spacing.md },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  card: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { marginBottom: Spacing.md },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xs },
  cardName: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginRight: Spacing.sm },
  cardSportRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xs },
  cardSport: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  cardDesc: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardInfo: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  typeBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  typeRegular: { backgroundColor: Colors.status.scheduled + '20' },
  typePremium: { backgroundColor: Colors.tier.PREMIUM + '20' },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_600SemiBold' },
});

