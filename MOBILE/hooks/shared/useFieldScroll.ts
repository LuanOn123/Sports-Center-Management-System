// hooks/shared/useFieldScroll.ts
// Cuộn ScrollView tới ô đang nhập để bàn phím không che. Vị trí mỗi ô lấy từ onLayout của chính ô đó
// (không dùng offset cố định nên form thêm/bớt trường vẫn đúng). Các ô phải là con trực tiếp của khối đã gắn onContainerLayout.

import { useRef } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';
import { Spacing } from '../../constants/theme';

/** Chờ bàn phím mở xong rồi mới cuộn để vị trí tính đúng */
const SCROLL_DELAY_MS = 120;

export function useFieldScroll(topMargin: number = Spacing.xxl) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldY = useRef<Record<string, number>>({});
  const containerY = useRef(0);

  return {
    scrollRef,
    /** Gắn vào khối bọc tất cả các ô (vị trí khối trong ScrollView) */
    onContainerLayout: (e: LayoutChangeEvent) => {
      containerY.current = e.nativeEvent.layout.y;
    },
    /** Gắn vào từng ô: onLayout={onFieldLayout('phone')} */
    onFieldLayout: (name: string) => (e: LayoutChangeEvent) => {
      fieldY.current[name] = e.nativeEvent.layout.y;
    },
    scrollToField: (name: string) => {
      const y = fieldY.current[name];
      if (y === undefined) return;
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, containerY.current + y - topMargin), animated: true });
      }, SCROLL_DELAY_MS);
    },
  };
}

export type FieldScroll = ReturnType<typeof useFieldScroll>;
