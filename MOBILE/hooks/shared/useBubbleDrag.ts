// hooks/shared/useBubbleDrag.ts
// Cử chỉ kéo thả bong bóng bằng PanResponder (có sẵn trong React Native, chạy cả Expo Go lẫn web, không cần worklet).
// Một cơ chế duy nhất cho cả chạm và kéo: dịch chuyển rất nhỏ + thả nhanh = chạm (mở chat), còn lại là kéo.
// Khi đang kéo chỉ cập nhật giá trị Animated (không render lại React); thả ra mới báo vị trí cuối cho hook trạng thái.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, type PanResponderGestureState } from 'react-native';
import { BUBBLE_TAP_SLOP } from '../../constants/assistant';
import { clampPosition, isTap, type BubbleBounds, type Point } from '../../lib/assistantBubble';

interface Options {
  /** Vị trí hiện tại theo trạng thái (chưa tính lúc đang kéo) */
  position: Point;
  bounds: BubbleBounds;
  /** Thả tay sau khi kéo: vị trí cuối đã kẹp trong màn hình */
  onMoveEnd: (point: Point) => void;
  /** Chạm nhẹ vào bong bóng */
  onTap: () => void;
}

export function useBubbleDrag({ position, bounds, onMoveEnd, onTap }: Options) {
  const pan = useRef(new Animated.ValueXY(position)).current;
  const live = useRef<Point>(position);
  const origin = useRef<Point>(position);
  const startedAt = useRef(0);
  const dragging = useRef(false);
  // PanResponder chỉ tạo một lần nên đọc giá trị mới nhất qua ref
  const latest = useRef({ position, bounds, onMoveEnd, onTap });
  latest.current = { position, bounds, onMoveEnd, onTap };

  // Theo vị trí trong trạng thái (vị trí cố định, kẹp lại khi đổi khung) — trừ lúc ngón tay đang giữ
  useEffect(() => {
    if (dragging.current) return;
    live.current = position;
    pan.setValue(position);
  }, [pan, position]);

  const responder = useMemo(() => {
    const finish = (gesture: PanResponderGestureState, released: boolean) => {
      dragging.current = false;
      const { position: current, onMoveEnd: end, onTap: tap } = latest.current;
      if (Math.hypot(gesture.dx, gesture.dy) > BUBBLE_TAP_SLOP) {
        end(live.current);
        return;
      }
      // Nhích nhẹ không phải kéo: trả về đúng chỗ cũ
      live.current = current;
      pan.setValue(current);
      if (released && isTap({ dx: gesture.dx, dy: gesture.dy, durationMs: Date.now() - startedAt.current })) tap();
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Đã giữ bong bóng thì không để ScrollView bên dưới cướp cử chỉ
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragging.current = true;
        startedAt.current = Date.now();
        origin.current = latest.current.position;
      },
      onPanResponderMove: (_event, gesture) => {
        const next = clampPosition({ x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy }, latest.current.bounds);
        live.current = next;
        pan.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => finish(gesture, true),
      onPanResponderTerminate: (_event, gesture) => finish(gesture, false),
    });
  }, [pan]);

  return { panHandlers: responder.panHandlers, translate: pan.getTranslateTransform() };
}
