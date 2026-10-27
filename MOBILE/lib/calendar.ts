// lib/calendar.ts
// Lịch tuần / tháng dùng chung cho Hội viên (Lịch) và HLV (Lịch dạy) — toàn bộ theo giờ Việt Nam (GMT+7).
// Hai màn khác nhau ở dữ liệu và thẻ buổi học; khung lịch (điều hướng, dải ngày / lưới tháng, danh sách theo ngày) là một.

import type { CalendarMode } from '../constants/calendar';
import { WEEKDAY_LONG_FROM_MONDAY } from '../constants/schedule';
import {
  addDays, dayKey, endOfDay, endOfMonth, isSameDay, isSameMonth, monthWeeks, shiftMonth, startOfDay, startOfMonth,
  startOfWeek, vietnamDate, weekDays,
} from './date';
import { formatDayMonth, pad2 } from './format';

export interface CalendarPeriod {
  /** 00:00 ngày đầu kỳ (tuần: Thứ Hai, tháng: mùng 1) */
  start: Date;
  /** 23:59:59.999 ngày cuối kỳ */
  end: Date;
  /** Các hàng của lưới: tuần = 1 hàng 7 ngày, tháng = 4–6 hàng (gồm vài ngày của tháng kề) */
  weeks: Date[][];
}

/** Ngày bất kỳ thuộc kỳ đang xem (`anchor`) và ngày đang chọn (`selected`) */
export interface CalendarCursor {
  anchor: Date;
  selected: Date;
}

export function calendarPeriod(mode: CalendarMode, anchor: Date): CalendarPeriod {
  if (mode === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor), weeks: monthWeeks(anchor) };
  const days = weekDays(anchor);
  return { start: days[0], end: endOfDay(days[6]), weeks: [days] };
}

export function inPeriod(period: CalendarPeriod, day: Date) {
  return day.getTime() >= period.start.getTime() && day.getTime() <= period.end.getTime();
}

export const todayCursor = (now = new Date()): CalendarCursor => ({ anchor: now, selected: now });

/** Sang kỳ trước / sau: tuần ±7 ngày (ngày chọn đi theo), tháng ±1 tháng (chọn hôm nay nếu là tháng này, không thì mùng 1) */
export function shiftCursor(mode: CalendarMode, cursor: CalendarCursor, delta: number, now = new Date()): CalendarCursor {
  if (mode === 'week') return { anchor: addDays(cursor.anchor, 7 * delta), selected: addDays(cursor.selected, 7 * delta) };
  const anchor = shiftMonth(cursor.anchor, delta);
  return { anchor, selected: isSameMonth(anchor, now) ? startOfDay(now) : startOfMonth(anchor) };
}

/** Đổi chế độ xem: từ tháng về tuần thì hiện tuần chứa ngày đang chọn; từ tuần sang tháng thì giữ nguyên */
export function switchCursor(next: CalendarMode, cursor: CalendarCursor): CalendarCursor {
  return next === 'week' ? { anchor: cursor.selected, selected: cursor.selected } : cursor;
}

export function isCurrentPeriod(mode: CalendarMode, anchor: Date, now = new Date()) {
  return mode === 'month' ? isSameMonth(anchor, now) : isSameDay(startOfWeek(anchor), startOfWeek(now));
}

/** "26/10 – 01/11/2026" (tuần) hoặc "Tháng 10/2026" (tháng) */
export function periodTitle(mode: CalendarMode, anchor: Date) {
  if (mode === 'month') {
    const v = vietnamDate(anchor);
    return `Tháng ${pad2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  const days = weekDays(anchor);
  return `${formatDayMonth(days[0])} – ${formatDayMonth(days[6])}/${vietnamDate(days[6]).getUTCFullYear()}`;
}

/** Gom theo ngày (giờ VN), trong ngày xếp theo giờ bắt đầu */
export function groupByDay<T>(items: readonly T[], startOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => Date.parse(startOf(a)) - Date.parse(startOf(b)));
  for (const item of sorted) {
    const key = dayKey(new Date(startOf(item)));
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** "Thứ hai" … "Chủ nhật" — viết đủ chữ, không viết tắt */
export function weekdayLong(day: Date) {
  return WEEKDAY_LONG_FROM_MONDAY[(vietnamDate(day).getUTCDay() + 6) % 7];
}

/** "Thứ hai, 26/10/2026" */
export function dayHeading(day: Date) {
  const v = vietnamDate(day);
  return `${weekdayLong(day)}, ${pad2(v.getUTCDate())}/${pad2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
}
