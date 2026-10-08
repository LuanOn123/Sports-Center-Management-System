// lib/date.ts
// Tiện ích ngày/tuần dùng chung (tuần bắt đầu từ Thứ Hai, theo giờ máy)

const DAY_MS = 86_400_000;

export function startOfDay(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(d: Date) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

/** Thứ Hai đầu tuần chứa ngày d (00:00) */
export function startOfWeek(d: Date) {
  const date = startOfDay(d);
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** 7 ngày Thứ Hai → Chủ Nhật của tuần chứa d */
export function weekDays(d: Date) {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(d: Date) {
  return isSameDay(d, new Date());
}

export function daysFromNow(n: number) {
  return new Date(Date.now() + n * DAY_MS);
}

/** Số ngày (làm tròn lên, tối thiểu 0) từ bây giờ tới mốc ISO */
export function daysUntil(iso: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY_MS));
}
