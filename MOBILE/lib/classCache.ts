// lib/classCache.ts
// Chi tiết lớp dùng lại dữ liệu lớp đã có trong danh sách Khám phá để hiện NGAY khi bấm vào thẻ,
// thay vì chờ tải lại rồi mới hiện (người dùng thấy vòng tải thứ hai ngay sau khi vừa chờ danh sách).

import type { Class } from './types';

export interface ClassListEntry {
  data?: Class[];
}

/** Tìm lớp theo id trong các danh sách lớp đã có trong cache (kết quả của queryClient.getQueriesData) */
export function findClassInLists(entries: ReadonlyArray<readonly [unknown, ClassListEntry | undefined]>, id: string): Class | undefined {
  for (const [, list] of entries) {
    const found = list?.data?.find((c) => c.id === id);
    if (found) return found;
  }
  return undefined;
}
