// lib/coachSchedule.ts
// Lớp hiện ở bộ lọc Lịch dạy của HLV: lớp được phân công dài hạn + lớp xuất hiện trong lịch dạy
// (HLV dạy thay có buổi của lớp mà mình không được phân công) — giống calendarClasses của FE web (CoachWorkspace).

import type { Class, ClassSchedule } from './types';

export function calendarClasses(assigned: Class[], schedules: ClassSchedule[]): Class[] {
  const byId = new Map<string, Class>();
  for (const cls of [...assigned, ...schedules.map((s) => s.class)]) {
    if (cls?.id && !byId.has(cls.id)) byId.set(cls.id, cls);
  }
  return [...byId.values()];
}
