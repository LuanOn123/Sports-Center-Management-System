// lib/format.ts
// Định dạng hiển thị dùng chung (ngày giờ, tiền tệ)

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** dd/MM/yyyy */
export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Theo Date.getDay(): 0 = Chủ Nhật
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "T2, 05/10/2026" (short) hoặc "Thứ Hai, 05/10/2026" (long) */
export function formatWeekdayDate(iso: string, style: 'short' | 'long' = 'short') {
  const d = new Date(iso);
  const names = style === 'long' ? WEEKDAY_LONG : WEEKDAY_SHORT;
  return `${names[d.getDay()]}, ${formatDate(iso)}`;
}

/** dd/MM */
export function formatDayMonth(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** HH:mm */
export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
