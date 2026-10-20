// lib/format.ts
import { vietnamDate } from './date';
// Định dạng hiển thị dùng chung (ngày giờ, tiền tệ)

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** dd/MM/yyyy */
export function formatDate(iso: string) {
  const d = vietnamDate(iso);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Theo Date.getDay(): 0 = Chủ Nhật
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "T2, 05/10/2026" (short) hoặc "Thứ Hai, 05/10/2026" (long) */
export function formatWeekdayDate(iso: string, style: 'short' | 'long' = 'short') {
  const d = vietnamDate(iso);
  const names = style === 'long' ? WEEKDAY_LONG : WEEKDAY_SHORT;
  return `${names[d.getUTCDay()]}, ${formatDate(iso)}`;
}

/** dd/MM */
export function formatDayMonth(d: Date) {
  const vn = vietnamDate(d);
  return `${pad2(vn.getUTCDate())}/${pad2(vn.getUTCMonth() + 1)}`;
}

/** HH:mm */
export function formatTime(iso: string) {
  const d = vietnamDate(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** mm:ss từ số mili-giây còn lại */
export function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}`;
}

/** 300000 → "300.000 ₫" (BE trả Decimal dạng string nên nhận cả string) */
export function formatVnd(amount: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
}

/** Lời chào theo giờ Việt Nam */
export function greetingFor(now = new Date()) {
  const h = vietnamDate(now).getUTCHours();
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

/** Mốc bắt đầu của một buổi so với hiện tại: "Đang diễn ra", "Bắt đầu sau 25 phút", "Hôm nay, 18:00", "Ngày mai, 06:30", "T5, 22/10/2026 · 18:00" */
export function formatStartsIn(startIso: string, endIso: string, now = new Date()) {
  const start = Date.parse(startIso);
  const t = now.getTime();
  if (t >= start && t <= Date.parse(endIso)) return 'Đang diễn ra';
  const minutes = Math.ceil((start - t) / 60_000);
  if (minutes > 0 && minutes < 60) return `Bắt đầu sau ${minutes} phút`;
  const dayKey = (ms: number) => vietnamDate(new Date(ms)).toISOString().slice(0, 10);
  if (dayKey(start) === dayKey(t)) return `Hôm nay, ${formatTime(startIso)}`;
  if (dayKey(start) === dayKey(t + 86_400_000)) return `Ngày mai, ${formatTime(startIso)}`;
  return `${formatWeekdayDate(startIso)} · ${formatTime(startIso)}`;
}

