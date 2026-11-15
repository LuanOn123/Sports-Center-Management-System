// lib/enrollmentBlockers.ts
// Quy tắc thuần về điều kiện chặn đăng ký trọn khóa — cùng cách xử lý với web (ClassDetailPage: blockerActions /
// courseBlockers). Chỉ GIẢI THÍCH và dẫn đường cho hội viên; quyền đăng ký thật do BE quyết định.

import { BLOCKER_CODE, ENROLL_TEXT, MEMBERSHIP_FIX_CODES, type EnrollAction } from '../constants/enrollment';
import type { TermPhase } from '../constants/terms';
import type { CourseRegistrationBlocker, MembershipTier } from './types';

/** Cách hội viên gỡ các điều kiện đang chặn */
export interface BlockerGuidance {
  /** Việc cần làm ở màn Gói thành viên (xem / mua / nâng cấp / gia hạn); null nếu gói không giúp được */
  membership: Exclude<EnrollAction, 'held'> | null;
  /** Hết quota ở hạng trả phí → xem các lớp đang giữ chỗ để hoàn thành hoặc nhờ lễ tân hủy bớt */
  heldClasses: boolean;
  /** Đang bị tạm khóa đặt lớp vì chuyên cần → chỉ quản lý mở lại được */
  contactManager: boolean;
}

/**
 * Quota của tài khoản FREE (giới hạn 0): thiếu quyền đăng ký lớp chứ không phải "đã đầy" nên phải mua gói.
 * Hạng lấy từ `details.tier` của blocker, thiếu thì dùng hạng trong quota của course-plan (như web).
 */
export function isFreeQuotaBlocker(blocker: CourseRegistrationBlocker, fallbackTier?: MembershipTier | null) {
  return blocker.code === BLOCKER_CODE.quotaReached && (blocker.details?.tier ?? fallbackTier) === 'FREE';
}

export function blockerGuidance(
  blockers: readonly CourseRegistrationBlocker[],
  fallbackTier?: MembershipTier | null,
): BlockerGuidance {
  const codes = blockers.map((blocker) => blocker.code);
  const freeNeedsPlan = blockers.some((blocker) => isFreeQuotaBlocker(blocker, fallbackTier));
  const needsMembership = freeNeedsPlan || codes.some((code) => MEMBERSHIP_FIX_CODES.includes(code));
  const membership = !needsMembership
    ? null
    : freeNeedsPlan
      ? 'plans'
      : codes.includes(BLOCKER_CODE.noSubscription)
        ? 'buy'
        : codes.includes(BLOCKER_CODE.premiumRequired)
          ? 'upgrade'
          : 'renew';
  return {
    membership,
    heldClasses: codes.includes(BLOCKER_CODE.quotaReached) && !freeNeedsPlan,
    contactManager: codes.includes(BLOCKER_CODE.attendancePenalty),
  };
}

/** Các việc gỡ vướng cần hiện thành nút: cách xử lý bằng gói trước, rồi xem lớp đang giữ (web: thứ tự nút ở blockerActions) */
export function guidanceActions(guidance: BlockerGuidance): EnrollAction[] {
  return [...(guidance.membership ? [guidance.membership] : []), ...(guidance.heldClasses ? (['held'] as const) : [])];
}

/**
 * Các blocker trong lỗi 409 COURSE_ENROLLMENT_FAILED. BE đặt chúng ở `errors.details` — `errors` là một object
 * `{ code, details: [...] }` chứ không phải danh sách lỗi theo trường (web: courseBlockers).
 */
export function enrollFailureBlockers(errors: unknown): CourseRegistrationBlocker[] {
  const details = (errors as { details?: unknown } | null | undefined)?.details;
  return Array.isArray(details) ? (details as CourseRegistrationBlocker[]) : [];
}

export type CourseFooterKind = 'registered' | 'enroll' | 'term' | 'membership' | 'held' | 'blocked';

export interface CourseFooter {
  kind: CourseFooterKind;
  title: string;
  /** Nút chỉ để báo trạng thái, không bấm được */
  disabled: boolean;
  /** Việc mở ra khi bấm (kind 'membership' / 'held') */
  action?: EnrollAction;
}

/** Giai đoạn kỳ học khiến nút đăng ký chỉ còn báo trạng thái (đang mở đăng ký thì không có nhãn riêng) */
type ClosedTermPhase = Exclude<TermPhase, 'open'>;

/**
 * Nút cố định dưới đáy chi tiết lớp (hội viên). Thứ tự ưu tiên giống nhãn nút đăng ký của web:
 * đã đủ khóa > đủ điều kiện (đăng ký) > kỳ học chưa/không nhận đăng ký > cách gỡ bằng gói > xem lớp đang giữ > chưa thể.
 */
export function courseFooter(input: {
  isFullyRegistered: boolean;
  eligible: boolean;
  totalSessions: number;
  termPhase: TermPhase | null;
  guidance: BlockerGuidance;
}): CourseFooter {
  if (input.isFullyRegistered) return { kind: 'registered', title: ENROLL_TEXT.footer.registered, disabled: true };
  if (input.eligible) return { kind: 'enroll', title: ENROLL_TEXT.footer.enroll(input.totalSessions), disabled: false };
  if (input.termPhase && input.termPhase !== 'open') {
    return { kind: 'term', title: ENROLL_TEXT.footer.term[input.termPhase as ClosedTermPhase], disabled: true };
  }
  if (input.guidance.membership) {
    return { kind: 'membership', title: ENROLL_TEXT.action[input.guidance.membership], disabled: false, action: input.guidance.membership };
  }
  if (input.guidance.heldClasses) {
    return { kind: 'held', title: ENROLL_TEXT.action.held, disabled: false, action: 'held' };
  }
  return { kind: 'blocked', title: ENROLL_TEXT.footer.blocked, disabled: true };
}
