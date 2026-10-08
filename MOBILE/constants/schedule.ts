// constants/schedule.ts
// Nhãn/màu trạng thái buổi học và khoảng thời gian tải lịch dạy (khớp FE web)

import { Colors } from './theme';
import type { ScheduleStatus } from '../lib/types';

// Nhãn giống FE web (FE/src/shared/config.ts)
export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  SCHEDULED: 'Đã lên lịch',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const SCHEDULE_STATUS_COLOR: Record<ScheduleStatus, string> = {
  SCHEDULED: Colors.status.scheduled,
  COMPLETED: Colors.status.completed,
  CANCELLED: Colors.status.cancelled,
};

export const SCHEDULE_STATUSES: ScheduleStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

/** Tên thứ bắt đầu từ Thứ Hai (index 0) — như màn Lịch dạy của web */
export const WEEKDAY_LONG_FROM_MONDAY = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

/** Trang chủ HLV: số ngày tới để hiện "Lịch dạy sắp tới" */
export const COACH_UPCOMING_DAYS = 14;

/** Màn điểm danh HLV: các buổi từ N ngày trước tới M ngày tới */
export const COACH_ATTENDANCE_PAST_DAYS = 1;
export const COACH_ATTENDANCE_FUTURE_DAYS = 7;
