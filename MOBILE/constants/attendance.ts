// constants/attendance.ts
// Trạng thái điểm danh và cửa sổ thời gian — khớp FE web (FE/src/shared/Attendance.tsx, businessRules.ts)

import { Colors } from './theme';
import type { AttendanceBucketStatus, AttendancePenaltyStatus, AttendanceStatus } from '../lib/types';

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

/** Mức chuyên cần của một lớp (BE: attendance summary) */
export const BUCKET_STATUS_LABEL: Record<AttendanceBucketStatus, string> = {
  NORMAL: 'Bình thường',
  NOTICE: 'Nhắc nhở',
  WARNING: 'Cảnh báo',
};

export const BUCKET_STATUS_COLOR: Record<AttendanceBucketStatus, string> = {
  NORMAL: Colors.status.success,
  NOTICE: Colors.status.pending,
  WARNING: Colors.status.expired,
};

/** Trạng thái quyết định chuyên cần (hạn chế đặt lớp) */
export const PENALTY_STATUS_LABEL: Record<AttendancePenaltyStatus, string> = {
  PENDING: 'Đang chờ',
  APPLIED: 'Đã áp dụng',
  REVOKED: 'Đã gỡ',
  EXPIRED: 'Đã hết hiệu lực',
};

/** Lý do khiếu nại quyết định chuyên cần: tối thiểu 5 ký tự, tối đa 1000 (web: AttendancePage) */
export const APPEAL_REASON_MIN = 5;
export const APPEAL_REASON_MAX = 1000;

/** Chữ của màn "Chuyên cần & Điểm danh" của hội viên (web: AttendancePage) */
export const MY_ATTENDANCE_TEXT = {
  title: 'Chuyên cần & Điểm danh',
  scan: 'Quét QR / Nhập mã điểm danh',
  scanOk: { title: 'Điểm danh thành công', message: 'Đã ghi nhận điểm danh của bạn.' },
  scanFail: 'Không thể điểm danh',
  rateTitle: 'Tỉ lệ chuyên cần theo lớp',
  rateRule: 'Khóa cố định tính số lần vắng theo 20% tổng buổi kế hoạch. Lớp định kỳ tính trên 10 buổi gần nhất, tối thiểu 5 buổi. Cảnh báo chỉ để tham khảo; hạn chế đặt lớp do quản lý quyết định.',
  rateEmpty: 'Chưa có dữ liệu chuyên cần.',
  rateEmptyHint: 'Tỉ lệ sẽ hiển thị sau khi buổi học đầu tiên bạn đã đặt kết thúc.',
  sampleSize: (n: number) => `${n} buổi được tính`,
  counts: (b: { presentCount: number; lateCount: number; absentCount: number; noShowCount: number; excusedCount: number }) =>
    `Có mặt ${b.presentCount} · muộn ${b.lateCount} · vắng ${b.absentCount} · không điểm danh ${b.noShowCount} · có phép ${b.excusedCount}`,
  fixedPolicy: (planned: number | null) => `Khóa cố định · ${planned ?? '—'} buổi kế hoạch`,
  recurringPolicy: 'Lớp định kỳ',
  absences: (b: { currentAbsences: number; allowedAbsences: number; remainingAbsences: number }) =>
    `Vắng ${b.currentAbsences}/${b.allowedAbsences} · Còn ${b.remainingAbsences} lần vắng`,
  penaltyTitle: 'Quyết định chuyên cần',
  blockedUntil: (date: string) => `Không thể đặt lại lớp đến ${date}.`,
  appealed: (reason: string | null | undefined) => `Đã gửi khiếu nại: ${reason ?? ''}`,
  appeal: 'Gửi khiếu nại',
  appealPlaceholder: 'Nêu rõ lý do khiếu nại (ít nhất 5 ký tự)...',
  cancel: 'Hủy',
  historyTitle: 'Lịch sử điểm danh',
  historyEmpty: 'Chưa có bản ghi điểm danh',
  historyEmptyHint: 'Các buổi điểm danh của bạn sẽ xuất hiện tại đây.',
  sessionFallback: 'Buổi học',
} as const;

/** Khung ngắm QR (4 góc trên camera toàn màn hình): cạnh tối đa (px) và tỉ lệ tối đa theo chiều cao màn hình */
export const QR_SCAN_FRAME_MAX = 340;
export const QR_SCAN_FRAME_HEIGHT_RATIO = 0.5;
