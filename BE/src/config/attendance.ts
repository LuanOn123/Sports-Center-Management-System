/**
 * FINAL — Hai lớp tách bạch, không tự “kết án” member:
 *
 * Lớp 1 — Advisory (tự động, thuần thông báo):
 * - Lớp CỐ ĐỊNH (có totalPlannedSessions): allowance = floor(total × 20%).
 *   currentAbsences (ABSENT + NO_SHOW, EXCUSED/cancelled/tương lai/chưa chốt loại) so với allowance:
 *   < allowance -> NORMAL; == allowance -> NOTICE; > allowance -> WARNING.
 *   Không yêu cầu mẫu tối thiểu 5 — tổng số buổi kế hoạch đã định nghĩa chính sách.
 * - Lớp ĐỊNH KỲ (không có totalPlannedSessions): fallback rolling 10 buổi,
 *   >= 80% -> NORMAL; 70–<80% -> NOTICE; <70% -> WARNING; < MIN_SAMPLE -> NORMAL.
 * - KHÔNG phạt / KHÔNG khóa booking / KHÔNG hủy / KHÔNG rút ngắn-kéo dài gói.
 *
 * Lớp 2 — Penalty thủ công (quyết định của con người):
 * - Manager xem NOTICE/WARNING + lịch sử → nếu cần mới gọi POST /attendance/penalties/apply
 *   với lý do rõ ràng (audit decidedBy) → tạo AttendancePenalty → ATTENDANCE_PENALTY_ACTIVE
 *   chặn booking đúng (member × class) tới blockedUntil.
 * - WARNING không bao giờ tự sinh Penalty; Penalty không bao giờ sinh từ scan job.
 *
 * Tập trung một nơi để tránh hard-code rải rác trong service.
 */
export const ATTENDANCE = {
  /** Số schedule đã kết thúc gần nhất được đưa vào mẫu cho mỗi (member × class) ĐỊNH KỲ. */
  SAMPLE_WINDOW: 10,
  /** Mẫu tối thiểu cho lớp ĐỊNH KỲ; dưới ngưỡng này luôn là NORMAL. Lớp CỐ ĐỊNH không dùng. */
  MIN_SAMPLE: 5,
  /** rate >= 80% -> NORMAL (lớp định kỳ, advisory, không thông báo). */
  WARN_THRESHOLD: 80,
  /** 70% <= rate < 80% -> NOTICE; rate < 70% -> WARNING (lớp định kỳ, advisory, không tự phạt). */
  RELEASE_THRESHOLD: 70,
  /** Tỷ lệ vắng cho phép của lớp CỐ ĐỊNH (20% tổng số buổi kế hoạch). */
  ABSENCE_ALLOWANCE_PERCENT: 20,
  /** Thời hạn chặn đặt lại Class sau khi áp dụng penalty. */
  PENALTY_BLOCK_DAYS: 30,
  /** Cửa sổ hội viên được gửi khiếu nại (appeal). */
  APPEAL_WINDOW_HOURS: 72,
  /** Marker trên Attendance.note cho ABSENT do hệ thống tự tạo khi complete schedule. */
  SYSTEM_NO_SHOW_NOTE: "SYSTEM_NO_SHOW",
  /** Marker trên Attendance.note khi member tự điểm danh bằng QR (giữ nguyên semantics cũ). */
  QR_NOTE: "Tự động điểm danh qua QR",
  /** Marker trên Attendance.note khi member nhập mã dự phòng vì không quét được QR. */
  MANUAL_CODE_NOTE: "Điểm danh bằng mã dự phòng (nhập tay)",
  /** TTL của JWT trong mã QR (giây) — giữ nguyên hành vi hiện tại: 600s = 10 phút, FE tự refresh 55s. */
  QR_TTL_SECONDS: 600,
  /** TTL của mã dự phòng nhập tay (giây) — ngắn hơn QR để hạn chế chia sẻ. */
  MANUAL_CODE_TTL_SECONDS: 90,
  /**
   * Cửa sổ điểm danh do SERVER quyết định: member chỉ tự điểm danh được trong
   * [startTime − SCAN_OPEN_MINUTES_BEFORE phút, endTime + SCAN_CLOSE_MINUTES_AFTER phút]
   * và buổi học phải đang SCHEDULED. QR/mã sinh cho buổi ngoài cửa sổ cũng bị chặn.
   */
  SCAN_OPEN_MINUTES_BEFORE: 30,
  SCAN_CLOSE_MINUTES_AFTER: 0,
  /** Độ dài mã dự phòng. */
  MANUAL_CODE_LENGTH: 6,
  /** Alphabet mã dự phòng — bỏ 0/O/1/I để gõ tay không nhầm. */
  MANUAL_CODE_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  /** Một mã bị dùng KHÔNG thành công đủ số lần này → mã bị thu hồi (chống dò mã/lạm dụng). */
  MANUAL_CODE_MAX_ATTEMPTS: 5,
  /** Tổng số lần nhập mã sai tối đa của MỘT member trong cửa sổ bên dưới → chặn 429. */
  MEMBER_MANUAL_CODE_MAX_FAILURES: 10,
  /** Cửa sổ đếm lần nhập sai của member (phút). */
  MEMBER_MANUAL_CODE_WINDOW_MINUTES: 15,
} as const;

export type AttendanceBucketStatus = "NORMAL" | "NOTICE" | "WARNING";

export type AttendancePolicyKind = "FIXED" | "RECURRING";

/** Xếp loại tư vấn lớp ĐỊNH KỲ theo rate (%) và kích thước mẫu — KHÔNG phạt/khóa/hủy. */
export function classifyAttendance(attendanceRate: number, sampleSize: number): AttendanceBucketStatus {
  if (sampleSize < ATTENDANCE.MIN_SAMPLE) return "NORMAL";
  if (attendanceRate >= ATTENDANCE.WARN_THRESHOLD) return "NORMAL";
  if (attendanceRate >= ATTENDANCE.RELEASE_THRESHOLD) return "NOTICE";
  return "WARNING";
}

/**
 * Số buổi vắng cho phép của lớp CỐ ĐỊNH: floor(totalPlannedSessions × 20%).
 * total <= 0 → 0 (không bịa tổng số buổi).
 */
export function absenceAllowance(totalPlannedSessions: number): number {
  if (!Number.isFinite(totalPlannedSessions) || totalPlannedSessions <= 0) return 0;
  return Math.floor(totalPlannedSessions * (ATTENDANCE.ABSENCE_ALLOWANCE_PERCENT / 100));
}

/**
 * Xếp loại tư vấn lớp CỐ ĐỊNH theo allowance — KHÔNG yêu cầu mẫu tối thiểu 5.
 * allowed = 0: 0 vắng -> NORMAL; vắng đầu tiên -> WARNING (đúng toán 80% cả khóa).
 */
export function classifyFixedAbsence(currentAbsences: number, allowedAbsences: number): AttendanceBucketStatus {
  if (currentAbsences < allowedAbsences) return "NORMAL";
  // allowance = 0 (chưa định nghĩa tổng buổi / tổng quá nhỏ): 0 vắng vẫn NORMAL,
  // vắng đầu tiên rơi xuống nhánh WARNING bên dưới (xem JSDoc).
  if (currentAbsences === 0 && allowedAbsences === 0) return "NORMAL";
  if (currentAbsences === allowedAbsences) return "NOTICE";
  return "WARNING";
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isSystemNoShow(note: string | null | undefined): boolean {
  return note === ATTENDANCE.SYSTEM_NO_SHOW_NOTE;
}
