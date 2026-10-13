import { apiRequest, ApiError, getFacilityId, type Envelope } from './api';

/** Never silently truncate a member's history or a coach's assigned classes. */
export async function allPages<T>(path: string, query: Record<string, string | undefined> = {}, signal?: AbortSignal): Promise<Envelope<T[]>> {
  const rows: T[] = [];
  const facilityAtStart = getFacilityId();
  for (let page = 1; page <= 100; page++) {
    if (getFacilityId() !== facilityAtStart) throw new ApiError('Cơ sở đã thay đổi. Vui lòng tải lại danh sách.', 409);
    const response = await apiRequest<T[]>(path, 'GET', { query: { ...query, page: String(page), limit: '100' }, signal });
    if (!Array.isArray(response.data) || (response.pagination && Number(response.pagination.page) !== page)) {
      throw new ApiError('Máy chủ chưa trả đúng danh sách dữ liệu. Vui lòng thử lại.', 502);
    }
    rows.push(...response.data);
    if (!response.pagination || page >= response.pagination.totalPages) return { ...response, data: rows };
  }
  throw new ApiError('Danh sách quá lớn. Vui lòng thu hẹp khoảng thời gian.', 400);
}
