// hooks/shared/useOwningFacility.ts
// Khi một màn chi tiết (lớp / buổi học) gặp 403 FORBIDDEN_SCOPE: dò xem dữ liệu thuộc cơ sở nào và cho đổi cơ sở một chạm.
// Gặp khi bấm thông báo của lớp ở cơ sở khác (BE gửi "Lớp học mới" cho mọi hội viên, không kèm cơ sở).

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { isWrongFacilityError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { findOwningFacility } from '../../services/facilityService';

/** `path`: route GET theo id của bản ghi (vd. /classes/:id); `error`: lỗi của query chi tiết đang hiển thị */
export function useOwningFacility(path: string | undefined, error: unknown) {
  const { facilities, currentFacility, selectFacility } = useAuth();
  const wrongFacility = isWrongFacilityError(error);
  const candidates = facilities.filter((f) => f.id !== currentFacility?.id);
  const probe = useQuery({
    queryKey: ['owning-facility', path, currentFacility?.id],
    queryFn: ({ signal }) => findOwningFacility(path!, candidates, signal),
    enabled: wrongFacility && Boolean(path) && candidates.length > 0,
    retry: false,
    staleTime: 60_000,
  });
  const owner = probe.data ?? null;

  return {
    wrongFacility,
    currentFacility,
    owner,
    probing: wrongFacility && candidates.length > 0 && !probe.isError && !probe.isSuccess,
    switchToOwner: async () => {
      if (!owner) return;
      try {
        await selectFacility(owner.id);
      } catch (e) {
        showAlert('Lỗi', e instanceof Error ? e.message : 'Không đổi được cơ sở. Vui lòng thử lại.');
      }
    },
  };
}
