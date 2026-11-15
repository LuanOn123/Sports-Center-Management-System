// lib/scheduleAnalytics.ts
// Số liệu tổng quan buổi dạy của HLV — cùng cách tính với FE web (shared/analytics/ScheduleAnalytics.tsx + data.ts):
// buổi đã hủy chỉ có mặt ở "Buổi trong kỳ" và "Đã hủy"; mọi bảng xếp hạng / biểu đồ còn lại chỉ đếm buổi không hủy.

import { WEEKDAY_SHORT_FROM_MONDAY } from '../constants/calendar';
import { TEACHING_SUMMARY_TEXT as TEXT } from '../constants/schedule';
import { vietnamDate } from './date';
import type { ClassSchedule } from './types';

export interface RankedItem {
  id: string;
  name: string;
  count: number;
}

/** Số buổi của một thứ trong tuần (T2…CN): `total` = buổi không hủy, `completed` = trong đó đã hoàn thành */
export interface WeekdayBucket {
  label: string;
  total: number;
  completed: number;
}

export interface ScheduleSummary {
  /** Mọi buổi trong kỳ, gồm cả buổi đã hủy */
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  /** Buổi không hủy */
  active: number;
  /** Lớp / phòng có buổi, nhiều buổi nhất trước */
  classes: RankedItem[];
  rooms: RankedItem[];
  weekdays: WeekdayBucket[];
}

/** Phần trăm làm tròn; null khi không có mẫu hoặc số liệu vô lý (web: ô chỉ số hiện "Σ" thay cho %) */
export function percentOf(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0 || part < 0 || part > total) return null;
  return Math.round((part / total) * 100);
}

/** Đếm số buổi theo nhóm, nhóm nhiều buổi nhất trước (cùng số thì giữ thứ tự xuất hiện) */
function rank(rows: readonly ClassSchedule[], idOf: (row: ClassSchedule) => string, nameOf: (row: ClassSchedule) => string): RankedItem[] {
  const groups = new Map<string, RankedItem>();
  for (const row of rows) {
    const id = idOf(row);
    groups.set(id, { id, name: nameOf(row), count: (groups.get(id)?.count ?? 0) + 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function summarizeSchedules(rows: readonly ClassSchedule[]): ScheduleSummary {
  const active = rows.filter((row) => row.status !== 'CANCELLED');
  const className = (row: ClassSchedule) => row.class?.name || TEXT.unknown;
  const roomName = (row: ClassSchedule) => row.room?.name || TEXT.unknown;

  const weekdays: WeekdayBucket[] = WEEKDAY_SHORT_FROM_MONDAY.map((label) => ({ label, total: 0, completed: 0 }));
  for (const row of active) {
    const index = (vietnamDate(row.startTime).getUTCDay() + 6) % 7; // Thứ Hai = 0
    weekdays[index].total += 1;
    if (row.status === 'COMPLETED') weekdays[index].completed += 1;
  }

  return {
    total: rows.length,
    scheduled: rows.filter((row) => row.status === 'SCHEDULED').length,
    completed: rows.filter((row) => row.status === 'COMPLETED').length,
    cancelled: rows.length - active.length,
    active: active.length,
    classes: rank(active, (row) => row.classId || row.class?.id || className(row), className),
    rooms: rank(active, (row) => row.roomId || row.room?.id || roomName(row), roomName),
    weekdays,
  };
}
