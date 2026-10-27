// constants/calendar.ts
// Lịch dùng chung cho Hội viên (Lịch) và HLV (Lịch dạy): chế độ xem Tuần / Tháng, nhãn thứ, câu chữ.

export type CalendarMode = 'week' | 'month';

export const CALENDAR_MODES: { value: CalendarMode; label: string }[] = [
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
];

/** Nhãn thứ ngắn trên dải ngày / lưới tháng, bắt đầu từ Thứ Hai */
export const WEEKDAY_SHORT_FROM_MONDAY = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Số chấm tối đa dưới một ngày (mỗi chấm = một buổi, từ 3 buổi trở lên vẫn chỉ hiện 3 chấm) */
export const MAX_DAY_DOTS = 3;

export const CALENDAR_TEXT = {
  today: 'Hôm nay',
  backToToday: 'Về hôm nay',
  thisWeek: 'Tuần này',
  thisMonth: 'Tháng này',
  prev: { week: 'Tuần trước', month: 'Tháng trước' },
  next: { week: 'Tuần sau', month: 'Tháng sau' },
  loadError: 'Không tải được lịch. Kéo xuống để thử lại.',
} as const;
