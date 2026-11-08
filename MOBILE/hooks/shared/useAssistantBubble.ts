// hooks/shared/useAssistantBubble.ts
// Trạng thái bong bóng trợ lý nổi: vị trí (cố định hoặc do người dùng kéo), dấu "x" tắt tạm và hiện lại sau 10 giây.
// Cử chỉ kéo thả nằm ở useBubbleDrag; hình học và thời gian ở lib/assistantBubble.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { BUBBLE_FOOTPRINT, BUBBLE_HINT_MS } from '../../constants/assistant';
import {
  clampPosition,
  defaultPosition,
  isHidden,
  msUntilRespawn,
  respawnAt,
  type BubbleBounds,
  type Point,
} from '../../lib/assistantBubble';

export function useAssistantBubble(bounds: BubbleBounds) {
  // Vị trí người dùng đã kéo tới; null = vị trí cố định
  const [custom, setCustom] = useState<Point | null>(null);
  // Mốc giờ bong bóng hiện lại; null = đang hiện
  const [hiddenUntil, setHiddenUntil] = useState<number | null>(null);
  // Dòng nhắc "sẽ hiện lại sau 10 giây" ngay chỗ bong bóng vừa biến mất
  const [hintY, setHintY] = useState<number | null>(null);

  // Luôn kẹp lại theo khung hiện tại (xoay máy, mở bàn phím): vị trí đã lưu không đổi nên đóng bàn phím là về chỗ cũ
  const position = useMemo(() => clampPosition(custom ?? defaultPosition(bounds), bounds), [bounds, custom]);
  const positionRef = useRef(position);
  positionRef.current = position;

  /** Tắt bong bóng: ẩn 10 giây rồi hiện lại ở vị trí cố định (mọi chỗ đã kéo tới bị bỏ) */
  const dismiss = useCallback(() => {
    setHintY(positionRef.current.y + BUBBLE_FOOTPRINT / 2);
    setHiddenUntil(respawnAt(Date.now()));
    setCustom(null);
  }, []);

  useEffect(() => {
    if (hiddenUntil === null) return;
    const show = () => setHiddenUntil(null);
    const timer = setTimeout(show, msUntilRespawn(hiddenUntil, Date.now()));
    // Hẹn giờ có thể bị treo khi app ở nền: quay lại mà đã quá giờ thì hiện ngay
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !isHidden(hiddenUntil, Date.now())) show();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [hiddenUntil]);

  useEffect(() => {
    if (hintY === null) return;
    const timer = setTimeout(() => setHintY(null), BUBBLE_HINT_MS);
    return () => clearTimeout(timer);
  }, [hintY]);

  return { visible: hiddenUntil === null, position, hintY, moveTo: setCustom, dismiss };
}
