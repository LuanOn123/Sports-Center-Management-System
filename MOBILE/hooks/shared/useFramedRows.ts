// hooks/shared/useFramedRows.ts
// Chiều cao khung cuộn để hiện vừa đúng `visibleRows` dòng đầu của một danh sách (các dòng còn lại kéo xuống trong khung).
// Dòng nào cũng báo chiều cao thật qua onRowLayout; tới khi đo đủ thì dùng chiều cao ước lượng để khung không giãn cả danh sách.

import { useCallback, useRef, useState } from 'react';
import { framedRowsHeight } from '../../lib/framedRows';

/** Chênh lệch dưới ngưỡng này (px) coi như không đổi — tránh dựng lại liên tục vì số lẻ của layout */
const HEIGHT_EPSILON = 0.5;

export function useFramedRows(visibleRows: number, estimatedRowHeight: number) {
  const heights = useRef<number[]>([]);
  const [measured, setMeasured] = useState<number | null>(null);

  const onRowLayout = useCallback((index: number, height: number) => {
    if (index >= visibleRows) return; // chỉ các dòng đầu quyết định chiều cao khung
    heights.current[index] = height;
    const total = framedRowsHeight(heights.current, visibleRows);
    if (total === null) return;
    setMeasured((previous) => (previous !== null && Math.abs(previous - total) < HEIGHT_EPSILON ? previous : total));
  }, [visibleRows]);

  return { frameHeight: measured ?? visibleRows * estimatedRowHeight, onRowLayout };
}
