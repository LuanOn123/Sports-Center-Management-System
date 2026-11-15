// components/coach/TeachingSummaryCharts.tsx
// Hai biểu đồ gọn của tổng quan buổi dạy: số buổi theo thứ (cột hai lớp: không hủy / hoàn thành) và bảng xếp hạng lớp / phòng.
// Dữ liệu đã tính sẵn ở lib/scheduleAnalytics.

import React from 'react';
import { View, Text } from 'react-native';
import { ProgressBar } from '../ui/ProgressBar';
import { COACH_SUMMARY_BAR_HEIGHT, TEACHING_SUMMARY_TEXT as TEXT } from '../../constants/schedule';
import { Colors } from '../../constants/theme';
import type { RankedItem, WeekdayBucket } from '../../lib/scheduleAnalytics';

/** Cột cao = số buổi không hủy của thứ đó; phần màu xanh ở đáy cột = số buổi đã hoàn thành (web: "Nhịp hoạt động theo thứ") */
export function WeekdayBars({ buckets }: { buckets: WeekdayBucket[] }) {
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.total));
  return (
    <View className="gap-xs">
      <Text className="text-sm font-bevn-semibold text-text-primary">{TEXT.weekdayTitle}</Text>
      <View className="flex-row gap-sm items-end" accessibilityLabel={TEXT.weekdayLegend}>
        {buckets.map((bucket) => (
          <View key={bucket.label} className="flex-1 items-center gap-xs">
            <Text className="text-xs text-text-primary font-bevn-medium">{bucket.total}</Text>
            <View className="w-full bg-bg-elevated rounded-sm justify-end" style={{ height: COACH_SUMMARY_BAR_HEIGHT }}>
              <View className="rounded-sm justify-end" style={{ height: (bucket.total / maximum) * COACH_SUMMARY_BAR_HEIGHT, backgroundColor: Colors.primary }}>
                <View className="rounded-sm" style={{ height: (bucket.completed / maximum) * COACH_SUMMARY_BAR_HEIGHT, backgroundColor: Colors.status.completed }} />
              </View>
            </View>
            <Text className="text-xs text-text-secondary font-bevn-regular">{bucket.label}</Text>
          </View>
        ))}
      </View>
      <Text className="text-[10px] text-text-muted font-bevn-regular">{TEXT.weekdayLegend}</Text>
    </View>
  );
}

/** Lớp hoặc phòng có nhiều buổi không hủy nhất, mỗi dòng một thanh theo tỉ lệ với dòng đầu */
export function RankingList({ title, items }: { title: string; items: RankedItem[] }) {
  if (!items.length) return null;
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <View className="gap-xs">
      <Text className="text-sm font-bevn-semibold text-text-primary">{title}</Text>
      {items.map((item) => (
        <View key={item.id} className="gap-0.5">
          <View className="flex-row justify-between">
            <Text className="flex-1 text-sm text-text-secondary font-bevn-regular mr-sm" numberOfLines={1}>{item.name}</Text>
            <Text className="text-sm text-text-primary font-bevn-semibold">{TEXT.rankCount(item.count)}</Text>
          </View>
          <ProgressBar value={item.count / maximum} />
        </View>
      ))}
    </View>
  );
}
