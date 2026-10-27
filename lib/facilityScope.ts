// lib/facilityScope.ts
// Câu giải thích khi một lớp / buổi học thuộc cơ sở khác cơ sở đang chọn (BE trả 403 FORBIDDEN_SCOPE).

import type { ScopedSubject } from '../constants/facility';

export interface WrongFacilityInput {
  subject: ScopedSubject;
  /** Tên cơ sở app đang chọn */
  currentName?: string | null;
  /** Tên cơ sở sở hữu dữ liệu — null khi chưa tìm ra */
  ownerName?: string | null;
  /** Đang dò các cơ sở khác */
  probing: boolean;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Nội dung thẻ: đang dò → tìm thấy cơ sở chủ → không tìm thấy ở cơ sở nào bạn truy cập được */
export function wrongFacilityBody({ subject, currentName, ownerName, probing }: WrongFacilityInput) {
  const current = currentName ? `cơ sở ${currentName}` : 'cơ sở bạn đang chọn';
  if (probing) return `Đang tìm cơ sở của ${subject} này…`;
  if (ownerName) return `${capitalize(subject)} này thuộc cơ sở ${ownerName}, còn bạn đang xem ${current}. Chuyển cơ sở để xem.`;
  return `${capitalize(subject)} này không thuộc ${current} và không có ở cơ sở nào khác bạn truy cập được. Có thể ${subject} đã bị xóa hoặc bạn mở từ thông báo cũ.`;
}
