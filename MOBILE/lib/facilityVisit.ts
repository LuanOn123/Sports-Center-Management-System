// lib/facilityVisit.ts
// Hàm thuần cho lượt vào cửa cơ sở (FacilityVisit)

/**
 * Lượt vào cửa MỚI xuất hiện sau mốc: `baselineId` là id lượt mới nhất lúc mở màn (null = lúc đó chưa có lượt nào).
 * Trả null khi lượt mới nhất vẫn là lượt đã biết — kể cả check-in trùng, vì BE không tạo lượt mới mà trả lại lượt cũ.
 */
export function newVisitSince<T extends { id: string }>(baselineId: string | null, latest: T | null | undefined): T | null {
  if (!latest || latest.id === baselineId) return null;
  return latest;
}
