// hooks/shared/useAccountHub.ts
// Logic tab "Tài khoản": thông tin người dùng, hạng gói (hội viên), menu theo vai trò, đăng xuất.

import { useAuth } from '../../context/AuthContext';
import { useMembershipData } from '../member/useMembership';
import { memberProfileIdOf } from '../../lib/businessRules';
import { showConfirm } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { getAccountMenuForRole } from '../../navigation/accountMenuConfig';

export function useAccountHub() {
  const { user, logout } = useAuth();
  const isMember = user?.role === 'MEMBER';
  // Hội viên: lấy hạng gói hiện tại (danh sách gói chỉ tải khi có hồ sơ hội viên)
  const membership = useMembershipData(isMember ? memberProfileIdOf(user) ?? undefined : undefined);

  const confirmLogout = () => {
    Haptic.warning();
    showConfirm('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', logout, undefined, 'Đăng xuất', true);
  };

  return {
    user,
    isMember,
    tier: isMember ? membership.effectiveTier : null,
    menu: getAccountMenuForRole(user?.role),
    confirmLogout,
  };
}
