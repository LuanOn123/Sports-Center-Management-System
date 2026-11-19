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

// ─── Điểm danh của huấn luyện viên (web: FE/src/shared/Attendance.tsx) ──────────────────────────────────────────────

/** Ghi chú điểm danh của HLV: không bắt buộc khi ghi mới, tối đa 1000 ký tự (web: ô "Ghi chú điểm danh") */
export const ATTENDANCE_NOTE_MAX_LENGTH = 1000;

/** BE đánh dấu bản ghi vắng do hệ thống tự tạo khi hoàn tất buổi (ATTENDANCE.SYSTEM_NO_SHOW_NOTE) bằng ghi chú này */
export const ATTENDANCE_SYSTEM_NO_SHOW_NOTE = 'SYSTEM_NO_SHOW';

export const COACH_ATTENDANCE_TEXT = {
  markButton: 'Điểm danh',
  pickerTitle: 'Kết quả điểm danh',
  noteLabel: 'Ghi chú điểm danh (không bắt buộc)',
  notePlaceholder: 'Ghi chú',
  pickerHint: 'Điểm danh đã lưu chỉ quản lý được sửa. "Vắng có phép" do quản lý ghi nhận.',
  noteOf: (note: string) => `Ghi chú: ${note}`,
  systemNoShow: 'Hệ thống tự ghi vắng vì chưa điểm danh',
  saveFailed: 'Không lưu được điểm danh',
  retry: 'Vui lòng thử lại.',
} as const;

// ─── Mã QR điểm danh do HLV tạo (web: FE/src/shared/QrAttendance.tsx) ──────────────────────────────────────────────

/** Làm mới mã mỗi chừng này: mã dự phòng chỉ sống 90 giây (BE) nên phải đổi đều để luôn còn hiệu lực (web: refetchInterval 55000) */
export const QR_REFRESH_MS = 55_000;

/**
 * Cạnh khung mã QR trên màn hình (px), ĐÃ GỒM viền trắng QR_CODE_QUIET_ZONE. Mã chứa JWT ~280 ký tự nên rất dày
 * (≈65 ô mỗi cạnh): 256px cho mỗi ô ~3.4px, vẫn vừa modal (máy 360px: 360 − 2×20 lề − 2×20 padding = 280px).
 */
export const QR_CODE_SIZE = 256;

/**
 * Viền trắng quanh mã QR (px, nằm TRONG QR_CODE_SIZE). Chuẩn QR cần vùng sáng ≥ 4 ô quanh mã để camera tìm ra
 * 3 ô định vị; thiếu viền thì mép đen của mã dính vào nền tối của app và máy hội viên quét mãi không nhận.
 */
export const QR_CODE_QUIET_ZONE = 16;

/** Hiện "Đã sao chép" chừng này mili-giây sau khi chép mã dự phòng */
export const QR_COPIED_MS = 2_000;

export const QR_TEXT = {
  title: 'Mã QR điểm danh',
  intro: 'Hội viên quét mã này hoặc nhập mã dự phòng để điểm danh. Tạo mã mới sẽ thu hồi mã dự phòng cũ của buổi học.',
  validFor: (time: string) => `Mã QR còn hiệu lực ${time}`,
  expired: 'Mã đã hết hạn. Vui lòng tạo mã mới.',
  manualTitle: 'MÃ DỰ PHÒNG (không quét được QR)',
  manualExpiresIn: (seconds: number) => `Hết hạn sau ${seconds}s`,
  manualExpired: 'Mã dự phòng đã hết hạn',
  copy: 'Sao chép mã',
  copied: 'Đã sao chép',
  refresh: 'Làm mới QR',
  refreshing: 'Đang tạo mã…',
  close: 'Đóng',
  failed: 'Không tạo được mã QR. Vui lòng thử lại.',
} as const;
