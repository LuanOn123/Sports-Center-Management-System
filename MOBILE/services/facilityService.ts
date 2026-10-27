// services/facilityService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { ApiError, apiRequest, isWrongFacilityError } from '../lib/api';
import type { Facility } from '../lib/types';
import { allPages } from '../lib/pagedApi';

/** GET /facilities — MEMBER/ADMIN thấy mọi cơ sở đang hoạt động, COACH chỉ thấy cơ sở được phân công */
export const getFacilities = () => allPages<Facility>('/facilities');

/**
 * Tìm cơ sở sở hữu một bản ghi theo id (lớp / buổi học). BE gắn dữ liệu theo cơ sở nên header X-Facility-Id không khớp
 * sẽ trả 403 FORBIDDEN_SCOPE → thử song song các cơ sở còn lại, cơ sở nào trả được dữ liệu là chủ.
 * Chỉ dùng cho route GET theo id. Không cơ sở nào khớp → null; lỗi khác (mạng, 5xx) được ném ra để màn hình báo thử lại.
 */
export async function findOwningFacility(path: string, candidates: Facility[], signal?: AbortSignal): Promise<Facility | null> {
  const results = await Promise.allSettled(
    candidates.map((facility) => apiRequest(path, 'GET', { signal, headers: { 'X-Facility-Id': facility.id } })),
  );
  const ownerIndex = results.findIndex((r) => r.status === 'fulfilled');
  if (ownerIndex >= 0) return candidates[ownerIndex];
  const unexpected = results.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected' && !isWrongFacilityError(r.reason) && !(r.reason instanceof ApiError && r.reason.status === 404),
  );
  if (unexpected) throw unexpected.reason;
  return null;
}
