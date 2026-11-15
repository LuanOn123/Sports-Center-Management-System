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

/** Tổng quan buổi dạy: bảng xếp hạng lớp / phòng chỉ hiện chừng này mục đầu (web: slice(0, 6)) */
export const COACH_SUMMARY_RANK_LIMIT = 6;

/** Chiều cao cột của biểu đồ số buổi theo thứ (px) */
export const COACH_SUMMARY_BAR_HEIGHT = 56;

/** Tổng quan buổi dạy của HLV (web: ScheduleAnalytics ở "Tổng quan huấn luyện viên") */
export const TEACHING_SUMMARY_TEXT = {
  title: { week: 'Tổng quan tuần dạy', month: 'Tổng quan tháng dạy' },
  timezone: 'giờ Việt Nam',
  kpi: { total: 'Buổi trong kỳ', scheduled: 'Đã lên lịch', completed: 'Hoàn thành', cancelled: 'Đã hủy' },
  kpiNote: {
    total: 'Gồm buổi đã hủy',
    ofAll: (percent: number) => `${percent}% tất cả buổi`,
    ofActive: (percent: number) => `${percent}% buổi không hủy`,
  },
  progressTitle: 'Tiến độ trong kỳ',
  progressLabel: (done: number, active: number, percent: number) => `${done} / ${active} buổi không hủy đã hoàn thành · ${percent}%`,
  progressEmpty: 'Chưa có buổi để tính tỷ lệ.',
  weekdayTitle: 'Số buổi theo thứ',
  weekdayLegend: 'Cột cao: buổi không hủy · Cột màu: hoàn thành',
  classesTitle: 'Lớp có nhiều buổi nhất',
  roomsTitle: 'Phân bổ phòng tập',
  rankCount: (count: number) => `${count} buổi`,
  summary: (classes: number, rooms: number, active: number) => `${classes} lớp · ${rooms} phòng · ${active} buổi không hủy`,
  empty: 'Chưa có buổi dạy trong kỳ này.',
  unknown: 'Chưa phân loại',
} as const;
