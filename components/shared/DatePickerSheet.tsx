// components/shared/DatePickerSheet.tsx
// Bộ chọn ngày dạng bottom sheet (3 cột Ngày / Tháng / Năm) — viết bằng JS thuần nên chạy được
// trên Android, iOS và web mà không cần build lại native. Chỉ cho chọn trong khoảng [min, max].

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { Icon } from './Icon';
import { Colors, Spacing } from '../../constants/theme';
import { compareDate, daysInMonth, parseIsoDate, toIsoDate, type DateParts } from '../../lib/profileFields';
import { Haptic } from '../../lib/haptics';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

interface ColumnItem {
  value: number;
  label: string;
}

function PickerColumn({ title, items, selected, onSelect, visible }: {
  title: string;
  items: ColumnItem[];
  selected: number;
  onSelect: (value: number) => void;
  visible: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.findIndex((i) => i.value === selected));

  // Đưa mục đang chọn vào giữa cột khi mở sheet
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, (index - Math.floor(VISIBLE_ITEMS / 2)) * ITEM_HEIGHT), animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <View className="flex-1">
      <Text className="text-xs text-text-muted font-bevn-medium text-center mb-xs">{title}</Text>
      <ScrollView ref={ref} style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {items.map((item) => {
          const active = item.value === selected;
          return (
            <TouchableOpacity
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${title} ${item.label}`}
              className={clsx('mx-xs rounded-md items-center justify-center', active && 'bg-primary')}
              style={{ height: ITEM_HEIGHT }}
              onPress={() => {
                Haptic.selection();
                onSelect(item.value);
              }}
            >
              <Text className={clsx('text-md', active ? 'text-text-inverse font-bevn-bold' : 'text-text-primary font-bevn-regular')}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Kẹp ngày vào [min, max] và vào số ngày thật của tháng */
function clampDate(parts: DateParts, min: DateParts, max: DateParts): DateParts {
  const next = { ...parts, day: Math.min(parts.day, daysInMonth(parts.year, parts.month)) };
  if (compareDate(next, min) < 0) return min;
  if (compareDate(next, max) > 0) return max;
  return next;
}

interface DatePickerSheetProps {
  visible: boolean;
  title: string;
  /** "YYYY-MM-DD" hoặc rỗng */
  value?: string;
  /** Ngày được mở sẵn khi chưa có value (tự kẹp vào [min, max]) */
  defaultValue: DateParts;
  min: DateParts;
  max: DateParts;
  onConfirm: (isoDate: string) => void;
  onClose: () => void;
}

export function DatePickerSheet({ visible, title, value, defaultValue, min, max, onConfirm, onClose }: DatePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [parts, setParts] = useState<DateParts>(() => clampDate(defaultValue, min, max));

  useEffect(() => {
    if (visible) setParts(clampDate(parseIsoDate(value) ?? defaultValue, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const update = (patch: Partial<DateParts>) => setParts((prev) => clampDate({ ...prev, ...patch }, min, max));

  // Chỉ liệt kê tháng/ngày nằm trong khoảng cho phép của năm/tháng đang chọn
  const monthFrom = parts.year === min.year ? min.month : 1;
  const monthTo = parts.year === max.year ? max.month : 12;
  const dayFrom = parts.year === min.year && parts.month === min.month ? min.day : 1;
  const dayTo = parts.year === max.year && parts.month === max.month ? max.day : daysInMonth(parts.year, parts.month);
  const days = range(dayFrom, dayTo).map((v) => ({ value: v, label: String(v).padStart(2, '0') }));
  const months = range(monthFrom, monthTo).map((v) => ({ value: v, label: `Th ${v}` }));
  const years = range(min.year, max.year).reverse().map((v) => ({ value: v, label: String(v) }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-overlay justify-end" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          className="bg-bg-surface rounded-t-xl border-t border-border"
          style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
        >
          <View className="flex-row items-center justify-between px-xl pt-xl pb-md">
            <Text className="text-lg font-bevn-bold text-text-primary">{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Đóng">
              <Icon name="close" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View className="flex-row px-lg">
            <PickerColumn title="Ngày" items={days} selected={parts.day} onSelect={(day) => update({ day })} visible={visible} />
            <PickerColumn title="Tháng" items={months} selected={parts.month} onSelect={(month) => update({ month })} visible={visible} />
            <PickerColumn title="Năm" items={years} selected={parts.year} onSelect={(year) => update({ year })} visible={visible} />
          </View>

          <View className="px-xl pt-lg">
            <TouchableOpacity className="bg-primary rounded-md p-md items-center" onPress={() => onConfirm(toIsoDate(parts))}>
              <Text className="text-md text-text-inverse font-bevn-bold">Chọn</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
