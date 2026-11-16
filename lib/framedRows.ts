// lib/framedRows.ts
// Khung cuộn "vừa đúng N dòng đầu": các dòng cao thấp khác nhau (buổi hết chỗ có thêm nút danh sách chờ…) nên chiều cao khung
// là tổng chiều cao ĐÃ ĐO của N dòng đầu, không nhân một chiều cao cố định.

/** Tổng chiều cao của `visibleRows` dòng đầu; null khi chưa đo đủ (khi đó dùng chiều cao ước lượng) */
export function framedRowsHeight(heights: ReadonlyArray<number | undefined>, visibleRows: number): number | null {
  if (!Number.isInteger(visibleRows) || visibleRows <= 0) return null;
  let total = 0;
  for (let index = 0; index < visibleRows; index += 1) {
    const height = heights[index];
    if (height === undefined || !Number.isFinite(height) || height <= 0) return null;
    total += height;
  }
  return total;
}
