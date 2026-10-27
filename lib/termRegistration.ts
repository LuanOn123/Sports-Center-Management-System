// lib/termRegistration.ts
// Quy tắc thuần cho đăng ký theo kỳ học — giai đoạn đăng ký (giống web MemberTermBanner) và
// đăng ký muộn: quá hạn đăng ký vẫn được đăng ký khóa nếu gói còn ≥ 50% tổng thời hạn đã mua tại lúc đăng ký
// (vd gói 180 ngày còn ≥ 90 ngày). Phần tính ở đây chỉ để GIẢI THÍCH cho hội viên; quyền đăng ký thật do BE
// quyết định (registration.eligible / blockers) nên khi BE đã chặn thì không bao giờ báo "vẫn đăng ký được".

import {
  LATE_REGISTRATION_MIN_REMAINING_RATIO, LATE_REGISTRATION_TEXT, TERM_PHASE_LABEL, TERM_PHASE_TONE,
  type TermNoticeTone, type TermPhase,
} from '../constants/terms';
import { DAY_MS, daysUntil } from './date';
import { formatDate } from './format';

export interface TermWindow {
  name: string;
  status: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
}

export interface MembershipWindow {
  startDate: string;
  endDate: string;
  tier?: string;
  durationDaysSnapshot?: number;
  plan?: { durationDays?: number } | null;
}

export interface LateRegistration {
  allowed: boolean;
  /** Số ngày còn lại của gói (làm tròn lên, cùng cách "Còn N ngày" ở màn Gói tập) */
  remainingDays: number;
  /** Tổng thời hạn đã mua của gói (ngày) */
  totalDays: number;
  /** Số ngày tối thiểu cần còn để được đăng ký muộn */
  requiredDays: number;
}

export interface TermNotice {
  phase: TermPhase;
  label: string;
  tone: TermNoticeTone;
  message: string;
  /** Hiện nhãn "Đăng ký muộn": quá hạn đăng ký nhưng vẫn được đăng ký nhờ gói còn ≥ 50% */
  late: boolean;
  /** Gợi ý mở Gói tập: gói không đủ ≥ 50% hoặc chưa có gói */
  suggestPlans: boolean;
  /** Thông báo đã giải thích đủ lý do chặn → có thể ẩn dòng chặn "hết hạn đăng ký" của BE để khỏi lặp */
  coversBlocker: boolean;
}

/** Giai đoạn đăng ký — cùng thứ tự kiểm tra với web: CLOSED → PLANNING/chưa tới ngày → trong hạn → quá hạn */
export function termPhase(term: TermWindow, now = Date.now()): TermPhase {
  if (term.status === 'CLOSED') return 'ended';
  if (term.status === 'PLANNING') return 'planning';
  if (now < Date.parse(term.registrationStartDate)) return 'upcoming';
  if (now <= Date.parse(term.registrationEndDate)) return 'open';
  return 'closed';
}

export interface TermTag {
  name: string;
  /** Giai đoạn đăng ký: "Đang mở đăng ký", "Đã đóng đăng ký"… */
  label: string;
  tone: TermNoticeTone;
}

/**
 * Nhãn kỳ học trên thẻ lớp (web: "📅 Kỳ …" + trạng thái đăng ký) — chỉ nêu giai đoạn đăng ký của kỳ chứa lớp đó.
 * Đăng ký muộn chỉ nói ở chi tiết lớp, nơi BE đã xác nhận có cho đăng ký hay không.
 */
export function termTag(term: TermWindow, now = Date.now()): TermTag {
  const phase = termPhase(term, now);
  return { name: term.name, label: TERM_PHASE_LABEL[phase], tone: TERM_PHASE_TONE[phase] };
}

/** Tổng thời hạn đã mua: ưu tiên snapshot lúc mua, rồi thời hạn gói, cuối cùng là khoảng ngày bắt đầu → kết thúc */
export function purchasedDays(sub: MembershipWindow) {
  const days = sub.durationDaysSnapshot ?? sub.plan?.durationDays;
  if (days && days > 0) return days;
  return Math.max(1, Math.round((Date.parse(sub.endDate) - Date.parse(sub.startDate)) / DAY_MS));
}

/**
 * Gói còn ≥ 50% tổng thời hạn tại thời điểm `now`? So sánh trên đúng số ngày hiển thị (làm tròn lên)
 * để không bao giờ ghi "còn 90 ngày" mà lại báo chưa đủ 90. Gói FREE / chưa có gói → null (không có thời hạn đã mua).
 */
export function lateRegistration(sub: MembershipWindow | null | undefined, now = Date.now()): LateRegistration | null {
  if (!sub || sub.tier === 'FREE') return null;
  const totalDays = purchasedDays(sub);
  const remainingDays = daysUntil(sub.endDate, now);
  const requiredDays = Math.ceil(totalDays * LATE_REGISTRATION_MIN_REMAINING_RATIO);
  return { allowed: remainingDays >= requiredDays, remainingDays, totalDays, requiredDays };
}

/** Dòng giải thích quy tắc ở thẻ gói đang dùng; null khi gói không có thời hạn đã mua (FREE / chưa có gói) */
export function lateRegistrationHint(late: LateRegistration | null): { text: string; tone: 'success' | 'warning' } | null {
  if (!late) return null;
  const detail = `còn ${late.remainingDays}/${late.totalDays} ngày, cần ≥ ${late.requiredDays}`;
  return late.allowed
    ? { text: `Đăng ký muộn (sau hạn đăng ký kỳ học): đủ điều kiện — ${detail}`, tone: 'success' }
    : { text: `Đăng ký muộn (sau hạn đăng ký kỳ học): chưa đủ điều kiện — ${detail}`, tone: 'warning' };
}

/** "Gói của bạn còn 95/180 ngày" */
function planLeft(late: LateRegistration) {
  return `Gói của bạn còn ${late.remainingDays}/${late.totalDays} ngày`;
}

/**
 * Thông báo kỳ học cho hội viên.
 * `beBlocked`: BE có trả TERM_REGISTRATION_CLOSED cho khóa này không — true = BE chặn, false = BE cho phép,
 * undefined = chưa xét khóa cụ thể (màn Khám phá, chỉ ước lượng theo gói).
 */
export function termNotice(term: TermWindow, sub: MembershipWindow | null | undefined, now = Date.now(), beBlocked?: boolean): TermNotice {
  const phase = termPhase(term, now);
  const base = { phase, label: TERM_PHASE_LABEL[phase], late: false, suggestPlans: false, coversBlocker: false };
  const regEnd = formatDate(term.registrationEndDate);

  if (phase === 'ended') return { ...base, tone: 'muted', message: `Kỳ học kết thúc ngày ${formatDate(term.endDate)}.` };
  if (phase === 'planning' || phase === 'upcoming') {
    return { ...base, tone: 'info', message: `Dự kiến mở đăng ký từ ${formatDate(term.registrationStartDate)} đến ${regEnd}.` };
  }
  if (phase === 'open') {
    const days = daysUntil(term.registrationEndDate, now);
    return { ...base, tone: 'success', message: `Đăng ký đến ${regEnd}${days > 0 ? ` · còn ${days} ngày` : ' · hạn đăng ký hôm nay'}. Chọn lớp phù hợp với lịch tập của bạn.` };
  }

  // Quá hạn đăng ký → xét đăng ký muộn theo thời hạn gói
  const late = lateRegistration(sub, now);
  const closedLine = `Đã hết hạn đăng ký ngày ${regEnd}.`;

  if (beBlocked === false) {
    // BE đã cho phép đăng ký sau hạn → tin BE, không tự suy diễn ngược lại
    const detail = late ? `${planLeft(late)} (còn ít nhất 50% thời hạn)` : 'Gói của bạn còn ít nhất 50% thời hạn';
    return { ...base, tone: 'success', late: true, message: `${closedLine} ${detail} nên bạn vẫn đăng ký khóa được.` };
  }
  if (beBlocked === undefined && late?.allowed) {
    return { ...base, tone: 'success', late: true, message: `${closedLine} ${planLeft(late)} (còn ít nhất 50% thời hạn) nên bạn có thể đăng ký muộn.` };
  }
  if (late && !late.allowed) {
    return {
      ...base, tone: 'warning', suggestPlans: true, coversBlocker: true,
      message: `${closedLine} ${LATE_REGISTRATION_TEXT.rule} ${planLeft(late)}, cần còn ít nhất ${late.requiredDays} ngày.`,
    };
  }
  if (!late) {
    return { ...base, tone: 'warning', suggestPlans: true, coversBlocker: true, message: `${closedLine} ${LATE_REGISTRATION_TEXT.rule}` };
  }
  // Gói đủ điều kiện theo tính toán nhưng BE vẫn chặn → để lý do của BE hiển thị (BE là nguồn chính thức)
  return { ...base, tone: 'warning', message: closedLine };
}
