// constants/coachChanges.ts
// Nhãn + giới hạn cho luồng "Đổi HLV theo buổi" (BE: /coach-change-requests, web: CoachChangesPage).
// Coach không còn gửi đơn nghỉ phép — BE chỉ cho lễ tân tạo /leave-requests.

import { Colors } from './theme';

export type CoachChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CoachChangeFilter = 'ALL' | CoachChangeStatus;

/** Khớp zod BE: reason.trim() từ 3 đến 1000 ký tự */
export const COACH_CHANGE_REASON_MIN = 3;
export const COACH_CHANGE_REASON_MAX = 1000;

export const COACH_CHANGE_STATUS_LABEL: Record<CoachChangeStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export const COACH_CHANGE_STATUS_COLOR: Record<CoachChangeStatus, string> = {
  PENDING: Colors.status.pending,
  APPROVED: Colors.status.success,
  REJECTED: Colors.status.failed,
};

export const COACH_CHANGE_FILTERS: { value: CoachChangeFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
];

export const COACH_CHANGE_TEXT = {
  title: 'Đổi HLV theo buổi',
  intro: 'Gửi yêu cầu cho buổi bạn đang được phân công. Quản lý cơ sở sẽ chọn huấn luyện viên thay thế.',
  create: 'Tạo yêu cầu đổi HLV',
  sheetTitle: 'Yêu cầu đổi huấn luyện viên',
  sessionLabel: 'Buổi học cần đổi HLV',
  noSessions: 'Bạn chưa có buổi học sắp tới có thể gửi yêu cầu, hoặc các buổi đó đã có yêu cầu chờ duyệt.',
  scopeNote: 'Yêu cầu chỉ áp dụng cho buổi này; lịch dạy còn lại giữ nguyên.',
  reasonLabel: 'Lý do đề nghị đổi HLV',
  reasonPlaceholder: 'Nêu lý do cần bố trí huấn luyện viên khác cho buổi học này…',
  submit: 'Gửi yêu cầu',
  submitted: 'Đã gửi yêu cầu, đang chờ quản lý xét duyệt.',
  empty: 'Chưa có yêu cầu đổi huấn luyện viên',
  emptyDetail: 'Các yêu cầu theo từng buổi học sẽ hiển thị tại đây.',
  replacement: 'HLV thay thế',
  managerReply: 'Phản hồi của quản lý',
} as const;
