// components/assistant/AssistantBubble.tsx
// Bong bóng trợ lý AI nổi trên mọi màn hình sau khi đăng nhập:
// - kéo tới bất kỳ đâu trên màn hình (không dính cạnh, chỉ giữ trong màn hình);
// - chạm để mở chat; có thanh trạng thái nhỏ: đang chờ trả lời / có câu trả lời mới;
// - dấu "x" nhỏ ở góc: tắt khi bị vướng, 10 giây sau tự hiện lại ở vị trí cố định bên phải (constants/assistant.ts).
// Trạng thái ở hooks/shared/useAssistantBubble + useBubbleDrag, hình học ở lib/assistantBubble.ts.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../shared/Icon';
import {
  BUBBLE_CLOSE_OVERHANG,
  BUBBLE_CLOSE_SIZE,
  BUBBLE_FOOTPRINT,
  BUBBLE_HINT_TEXT,
  BUBBLE_LABELS,
  BUBBLE_SIZE,
} from '../../constants/assistant';
import { Colors, Shadow } from '../../constants/theme';
import { useAssistant } from '../../context/AssistantContext';
import { useAssistantBubble } from '../../hooks/shared/useAssistantBubble';
import { useBubbleDrag } from '../../hooks/shared/useBubbleDrag';
import { showsBubbleOn, type BubbleBounds } from '../../lib/assistantBubble';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';

/** Chặn mở chồng nhiều màn chat khi chạm đúp */
const OPEN_DEBOUNCE_MS = 800;

// Chỉ web: con trỏ "bàn tay", không bôi đen chữ và không cuộn trang khi kéo bằng cảm ứng
const WEB_DRAG_STYLE = Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object) : undefined;

export function AssistantBubble() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { pending, unread } = useAssistant();

  // Khung chứa = chính lớp phủ toàn màn hình (đổi khi xoay máy / mở bàn phím). Trước khi có số đo thật
  // (onLayout chưa chạy) dùng kích thước cửa sổ để bong bóng hiện ngay từ khung hình đầu tiên.
  const window = useWindowDimensions();
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const width = area?.width ?? window.width;
  const height = area?.height ?? window.height;
  const bounds = useMemo<BubbleBounds>(
    () => ({ width, height, insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right } }),
    [width, height, insets.top, insets.bottom, insets.left, insets.right],
  );

  const bubble = useAssistantBubble(bounds);
  const lastOpen = useRef(0);
  const open = useCallback(() => {
    const now = Date.now();
    if (now - lastOpen.current < OPEN_DEBOUNCE_MS) return;
    lastOpen.current = now;
    Haptic.light();
    router.push(ROUTES.aiAssistant);
  }, [router]);
  const drag = useBubbleDrag({ position: bubble.position, bounds, onMoveEnd: bubble.moveTo, onTap: open });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

  // Đang ở chính màn chat AI thì không cần bong bóng (các hook phía trên vẫn chạy để giữ vị trí)
  if (!showsBubbleOn(segments)) return null;

  return (
    <View style={styles.overlay} onLayout={onLayout}>
      {bubble.visible ? (
        <Animated.View style={[styles.anchor, { transform: drag.translate }]}>
          <View
            {...drag.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel={unread ? BUBBLE_LABELS.openUnread : BUBBLE_LABELS.open}
            onAccessibilityTap={open}
            style={[styles.circle, WEB_DRAG_STYLE]}
          >
            {pending ? <ActivityIndicator size="small" color={Colors.text.inverse} /> : <Icon name="auto-awesome" size={26} color={Colors.text.inverse} />}
          </View>
          {unread ? <View style={styles.unreadDot} /> : null}
          <TouchableOpacity
            style={styles.close}
            onPress={() => {
              Haptic.light();
              bubble.dismiss();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={BUBBLE_LABELS.close}
            hitSlop={{ top: 4, right: 4, bottom: 10, left: 10 }}
          >
            <Icon name="close" size={13} color={Colors.text.secondary} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {bubble.hintY !== null ? (
        <View style={[styles.hintRow, { top: bubble.hintY - 16 }]}>
          <View className="rounded-full border border-border bg-bg-elevated px-md py-sm">
            <Text className="text-xs font-bevn-medium text-text-primary">{BUBBLE_HINT_TEXT}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Phủ cả màn hình nhưng không chặn chạm: chỉ vòng tròn và dấu "x" nhận cử chỉ
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, pointerEvents: 'box-none' },
  anchor: { position: 'absolute', left: 0, top: 0, width: BUBBLE_FOOTPRINT, height: BUBBLE_FOOTPRINT, pointerEvents: 'box-none' },
  circle: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: Colors.feature.violet,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  close: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: BUBBLE_CLOSE_SIZE,
    height: BUBBLE_CLOSE_SIZE,
    borderRadius: BUBBLE_CLOSE_SIZE / 2,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    left: 2,
    top: BUBBLE_CLOSE_OVERHANG + 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.bg.primary,
    pointerEvents: 'none',
  },
  hintRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
});
