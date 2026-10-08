// constants/attendance.ts
// Trạng thái điểm danh và cửa sổ thời gian — khớp FE web (FE/src/shared/Attendance.tsx, businessRules.ts)

import { Colors } from './theme';
import type { AttendanceStatus } from '../lib/types';

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng mặt',
  LATE: 'Đi muộn',
  EXCUSED: 'Vắng có phép',
};

export const ATTENDANCE_STATUS_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: Colors.status.completed,
  ABSENT: Colors.status.expired,
  LATE: Colors.status.suspended,
  EXCUSED: Colors.status.scheduled,
};

/** HLV không được chọn "Vắng có phép" (chỉ quản lý) */
export const COACH_ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT'];

/** Mở điểm danh / tạo QR từ 30 phút trước giờ bắt đầu tới khi buổi kết thúc */
export const ATTENDANCE_OPEN_BEFORE_MS = 30 * 60_000;

/** Chỉ học viên ở các trạng thái này mới hiện trong danh sách điểm danh */
export const ATTENDANCE_ROSTER_STATUSES = ['BOOKED', 'COMPLETED'];
