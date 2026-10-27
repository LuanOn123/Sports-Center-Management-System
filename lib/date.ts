// lib/date.ts
// Tiện ích ngày/tuần theo giờ Việt Nam (GMT+7), giống lịch trên web.

export const DAY_MS = 86_400_000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60_000;

/** Shift for UTC getters only; this is not a real instant to send to the backend. */
export function vietnamDate(value: Date | string) {
  return new Date(new Date(value).getTime() + VIETNAM_OFFSET_MS);
}

/** Parse an explicit Vietnamese wall-clock value; reject impossible calendar dates. */
export function parseVietnamDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return NaN;
  const ms = Date.parse(`${value.replace(' ', 'T')}:00+07:00`);
  if (!Number.isFinite(ms)) return NaN;
  return vietnamDate(new Date(ms)).toISOString().slice(0, 16).replace('T', ' ') === value ? ms : NaN;
}

export function startOfDay(d: Date) {
  const date = vietnamDate(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - VIETNAM_OFFSET_MS);
}

export function endOfDay(d: Date) {
  return new Date(startOfDay(d).getTime() + DAY_MS - 1);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Thứ Hai đầu tuần chứa ngày d (00:00) */
export function startOfWeek(d: Date) {
  const date = startOfDay(d);
  const day = vietnamDate(date).getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** 7 ngày Thứ Hai → Chủ Nhật của tuần chứa d */
export function weekDays(d: Date) {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isToday(d: Date) {
  return isSameDay(d, new Date());
}

/** Khóa ngày theo giờ Việt Nam: "2026-10-27" — dùng để gom buổi học theo ngày */
export function dayKey(d: Date | string) {
  return vietnamDate(d).toISOString().slice(0, 10);
}

/** 00:00 mùng 1 của tháng chứa d */
export function startOfMonth(d: Date) {
  const v = vietnamDate(d);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), 1) - VIETNAM_OFFSET_MS);
}

/** 23:59:59.999 ngày cuối của tháng chứa d */
export function endOfMonth(d: Date) {
  const v = vietnamDate(d);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() + 1, 1) - VIETNAM_OFFSET_MS - 1);
}

/** Mùng 1 của tháng cách d `delta` tháng (âm = lùi) */
export function shiftMonth(d: Date, delta: number) {
  const v = vietnamDate(d);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() + delta, 1) - VIETNAM_OFFSET_MS);
}

export function isSameMonth(a: Date, b: Date) {
  const x = vietnamDate(a);
  const y = vietnamDate(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth();
}

/** Các tuần (T2 → CN) phủ kín tháng chứa d, mỗi phần tử là 00:00 của một ngày (gồm vài ngày của tháng kề hai đầu) */
export function monthWeeks(d: Date) {
  const first = startOfWeek(startOfMonth(d));
  const lastWeek = startOfWeek(endOfMonth(d));
  const count = Math.round((lastWeek.getTime() - first.getTime()) / (7 * DAY_MS)) + 1;
  return Array.from({ length: count }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
}

export function daysFromNow(n: number) {
  return new Date(Date.now() + n * DAY_MS);
}

/** Số ngày (làm tròn lên, tối thiểu 0) từ bây giờ tới mốc ISO */
export function daysUntil(iso: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY_MS));
}
