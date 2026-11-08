// lib/assistantBubble.ts
// Hình học và thời gian của bong bóng trợ lý nổi: kéo tới mọi nơi trên màn hình, vị trí cố định, tắt 10 giây rồi hiện lại.
// Hàm thuần (không React) để kiểm thử.

import {
  BUBBLE_DEFAULT_CENTER_Y_RATIO,
  BUBBLE_DEFAULT_SIDE,
  BUBBLE_EDGE_MARGIN,
  BUBBLE_FOOTPRINT,
  BUBBLE_RESPAWN_MS,
  BUBBLE_TAP_MAX_MS,
  BUBBLE_TAP_SLOP,
} from '../constants/assistant';

export interface Point {
  x: number;
  y: number;
}

/** Vùng chứa bong bóng (kích thước lớp phủ toàn màn hình) và phần an toàn (tai thỏ, thanh điều hướng) */
export interface BubbleBounds {
  width: number;
  height: number;
  insets: { top: number; bottom: number; left: number; right: number };
}

/** Miền toạ độ góc trên-trái hợp lệ của khung bong bóng (vòng tròn + dấu "x"), cách mép màn hình tối thiểu `margin` */
export function allowedRange(bounds: BubbleBounds, size = BUBBLE_FOOTPRINT, margin = BUBBLE_EDGE_MARGIN) {
  const minX = bounds.insets.left + margin;
  const minY = bounds.insets.top + margin;
  // Màn quá nhỏ (chia đôi màn hình, bàn phím mở): giữ bong bóng ở mép trên-trái thay vì cho toạ độ âm
  const maxX = Math.max(minX, bounds.width - bounds.insets.right - size - margin);
  const maxY = Math.max(minY, bounds.height - bounds.insets.bottom - size - margin);
  return { minX, maxX, minY, maxY };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Đưa vị trí về trong màn hình (kéo ra ngoài mép thì dừng ở mép) */
export function clampPosition(point: Point, bounds: BubbleBounds, size = BUBBLE_FOOTPRINT, margin = BUBBLE_EDGE_MARGIN): Point {
  const range = allowedRange(bounds, size, margin);
  return { x: clamp(point.x, range.minX, range.maxX), y: clamp(point.y, range.minY, range.maxY) };
}

/**
 * Vị trí cố định: sát mép phải (hoặc trái nếu đổi hằng số), tâm bong bóng ở BUBBLE_DEFAULT_CENTER_Y_RATIO
 * chiều cao vùng hiển thị — luôn nằm trong màn hình.
 */
export function defaultPosition(bounds: BubbleBounds, size = BUBBLE_FOOTPRINT, margin = BUBBLE_EDGE_MARGIN): Point {
  const range = allowedRange(bounds, size, margin);
  const x = BUBBLE_DEFAULT_SIDE === 'right' ? range.maxX : range.minX;
  const y = bounds.height * BUBBLE_DEFAULT_CENTER_Y_RATIO - size / 2;
  return clampPosition({ x, y }, bounds, size, margin);
}

/** Chạm (mở chat) hay kéo: dịch chuyển nhỏ và thả nhanh là chạm */
export function isTap(gesture: { dx: number; dy: number; durationMs: number }, slop = BUBBLE_TAP_SLOP, maxMs = BUBBLE_TAP_MAX_MS) {
  return Math.hypot(gesture.dx, gesture.dy) <= slop && gesture.durationMs <= maxMs;
}

/** Thời điểm bong bóng hiện lại sau khi bị tắt lúc `now` */
export function respawnAt(now: number, delayMs = BUBBLE_RESPAWN_MS) {
  return now + delayMs;
}

/** Bong bóng đang bị ẩn? (`hiddenUntil` = null nghĩa là đang hiện) */
export function isHidden(hiddenUntil: number | null, now: number) {
  return hiddenUntil !== null && now < hiddenUntil;
}

/** Còn bao lâu (ms) tới lúc hiện lại; 0 khi đã tới giờ hoặc đang hiện */
export function msUntilRespawn(hiddenUntil: number | null, now: number) {
  return hiddenUntil === null ? 0 : Math.max(0, hiddenUntil - now);
}

/**
 * Bong bóng chỉ hiện ở các màn dùng được trợ lý: trừ chính màn chat AI (đã ở trong đó rồi) —
 * `segments` là kết quả của useSegments() của expo-router.
 */
export function showsBubbleOn(segments: readonly string[]) {
  return segments[0] !== 'assistant';
}
