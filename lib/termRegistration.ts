// lib/termRegistration.ts
// Quy tắc thuần về kỳ học khi đăng ký lớp:
//  - giai đoạn đăng ký của kỳ (giống web MemberTermBanner): hết hạn đăng ký là hết, gói không nới được hạn này;
//  - quy tắc 50% của BE (HALF_REMAINING_TERM_V1): gói hết hạn trước buổi cuối của khóa vẫn đăng ký trọn kỳ được khi
//    tại lúc đăng ký gói còn ≥ 50% tổng thời hạn (so từ ngày bắt đầu → hết hạn gói).
// Quyền đăng ký thật do BE quyết định (registration.eligible / blockers / membershipCoverage); phần tính ở đây chỉ để
// GIẢI THÍCH cho hội viên nên khi BE đã chặn thì không bao giờ báo "vẫn đăng ký được".

import {
  MEMBERSHIP_COVERAGE_TEXT, MEMBERSHIP_HALF_HINT_TEXT, TERM_MEMBERSHIP_MIN_REMAINING_RATIO, TERM_MEMBERSHIP_POLICY,
  TERM_PHASE_LABEL, TERM_PHASE_TONE, type TermNoticeTone, type TermPhase,
} from '../constants/terms';
import { daysUntil } from './date';
import { formatDate } from './format';
import type { MembershipCoverage } from './types';

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
  status?: string;
}

export interface TermNotice {
  phase: TermPhase;
  label: string;
  tone: TermNoticeTone;
  message: string;
  /** Thông báo đã nói đủ lý do chặn theo giai đoạn kỳ học → ẩn dòng chặn tương ứng của BE để khỏi lặp */
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

/** Nhãn kỳ học trên thẻ lớp (web: "📅 Kỳ …" + trạng thái đăng ký) — chỉ nêu giai đoạn đăng ký của kỳ chứa lớp đó */
export function termTag(term: TermWindow, now = Date.now()): TermTag {
  const phase = termPhase(term, now);
  return { name: term.name, label: TERM_PHASE_LABEL[phase], tone: TERM_PHASE_TONE[phase] };
}

/** Thông báo kỳ học trong chi tiết lớp (web: các AlertBanner + chip "Kỳ học … · Cổng đăng ký còn N ngày") */
export function termNotice(term: TermWindow, now = Date.now()): TermNotice {
  const phase = termPhase(term, now);
  const base = { phase, label: TERM_PHASE_LABEL[phase], coversBlocker: phase !== 'open' };
  const regEnd = formatDate(term.registrationEndDate);

  if (phase === 'ended') return { ...base, tone: 'muted', message: `Kỳ học kết thúc ngày ${formatDate(term.endDate)}.` };
  if (phase === 'planning' || phase === 'upcoming') {
    return { ...base, tone: 'info', message: `Dự kiến mở đăng ký từ ${formatDate(term.registrationStartDate)} đến ${regEnd}.` };
  }
  if (phase === 'open') {
    const days = daysUntil(term.registrationEndDate, now);
    return { ...base, tone: 'success', message: `Đăng ký đến ${regEnd}${days > 0 ? ` · còn ${days} ngày` : ' · hạn đăng ký hôm nay'}. Chọn lớp phù hợp với lịch tập của bạn.` };
  }
  return { ...base, tone: 'warning', message: `Đã hết hạn đăng ký ngày ${regEnd}.` };
}

/**
 * Tỷ lệ thời hạn gói còn lại tại `now` (0 → 1), tính theo mili-giây như BE: (hết hạn − nay) / (hết hạn − bắt đầu).
 * Gói chưa bắt đầu, đã hết hạn, không còn hiệu lực hoặc ngày không hợp lệ → 0.
 */
export function membershipRemainingRatio(sub: MembershipWindow, now = Date.now()) {
  const start = Date.parse(sub.startDate);
  const end = Date.parse(sub.endDate);
  if ((sub.status && sub.status !== 'ACTIVE') || !Number.isFinite(start + end + now) || start > now || end <= now || end <= start) return 0;
  return (end - now) / (end - start);
}

export interface MembershipHalfHint {
  /** Phần trăm thời hạn còn lại, làm tròn xuống (49,9% hiển thị 49% — không bao giờ báo đủ khi chưa đủ) */
  percent: number;
  enough: boolean;
  tone: 'success' | 'warning';
  text: string;
}

/** Dòng giải thích ở thẻ gói đang dùng; null khi gói không có thời hạn mua (FREE / chưa có gói) */
export function membershipHalfHint(sub: MembershipWindow | null | undefined, now = Date.now()): MembershipHalfHint | null {
  if (!sub || sub.tier === 'FREE') return null;
  const ratio = membershipRemainingRatio(sub, now);
  const percent = Math.floor(ratio * 100);
  const enough = ratio >= TERM_MEMBERSHIP_MIN_REMAINING_RATIO;
  return enough
    ? { percent, enough, tone: 'success', text: MEMBERSHIP_HALF_HINT_TEXT.enough(percent) }
    : { percent, enough, tone: 'warning', text: MEMBERSHIP_HALF_HINT_TEXT.short(percent) };
}

/** Banner khi BE xác nhận gói hết hạn trước buổi cuối của khóa nhưng vẫn đủ điều kiện học trọn kỳ; null nếu BE không trả */
export function membershipCoverageNotice(coverage: MembershipCoverage | null | undefined) {
  if (!coverage || coverage.policy !== TERM_MEMBERSHIP_POLICY) return null;
  return {
    title: MEMBERSHIP_COVERAGE_TEXT.title,
    message: MEMBERSHIP_COVERAGE_TEXT.message(formatDate(coverage.validUntil), formatDate(coverage.subscriptionEndDate)),
  };
}
