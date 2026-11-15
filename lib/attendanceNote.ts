// lib/attendanceNote.ts
// Ghi chú điểm danh của huấn luyện viên (web: ô "Ghi chú điểm danh" trong shared/Attendance.tsx)

import {
  ATTENDANCE_NOTE_MAX_LENGTH, ATTENDANCE_SYSTEM_NO_SHOW_NOTE, COACH_ATTENDANCE_TEXT as TEXT,
} from '../constants/attendance';

/** Ghi chú gửi lên BE: bỏ khoảng trắng hai đầu, trống thì không gửi gì, quá dài thì cắt theo giới hạn của web */
export function attendanceNoteForSave(note: string | null | undefined): string | undefined {
  const trimmed = (note ?? '').trim();
  return trimmed ? trimmed.slice(0, ATTENDANCE_NOTE_MAX_LENGTH) : undefined;
}

/** Ghi chú để hiện cho người đọc: mã hệ thống "không điểm danh" đổi thành câu dễ hiểu; trống thì null */
export function displayAttendanceNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? '').trim();
  if (!trimmed) return null;
  return trimmed === ATTENDANCE_SYSTEM_NO_SHOW_NOTE ? TEXT.systemNoShow : trimmed;
}
