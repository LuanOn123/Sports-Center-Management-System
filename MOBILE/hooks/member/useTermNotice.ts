// hooks/member/useTermNotice.ts
// Thông báo kỳ học trong chi tiết lớp: giai đoạn đăng ký + đăng ký muộn khi gói còn ≥ 50% thời hạn (lib/termRegistration).
// Dùng chung cache 'subscriptions' với màn Gói tập nên không tải thêm dữ liệu gói.

import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { memberProfileIdOf } from '../../lib/businessRules';
import { termNotice, type TermWindow } from '../../lib/termRegistration';
import { useActiveSubscription } from './useMembership';

/**
 * `beBlocked`: BE có chặn khóa này vì hết hạn đăng ký không (true/false), undefined khi chưa xét khóa cụ thể.
 * Trả null khi chưa có kỳ học để hiển thị.
 */
export function useTermNotice(term: (TermWindow & { id?: string }) | null | undefined, beBlocked?: boolean) {
  const { user } = useAuth();
  const { activeSub } = useActiveSubscription(memberProfileIdOf(user) ?? undefined);
  return useMemo(() => (term ? termNotice(term, activeSub, Date.now(), beBlocked) : null), [term, activeSub, beBlocked]);
}
