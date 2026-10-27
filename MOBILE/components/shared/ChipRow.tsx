// components/shared/ChipRow.tsx
// Hàng chip lọc cuộn ngang (Lịch dạy của HLV…).
// ScrollView ngang của React Native mặc định flexGrow: 1 — đặt trong khung flex-1 nó chiếm hết chỗ trống và kéo giãn
// các chip theo chiều dọc thành hình oval khổng lồ. Vì vậy luôn khóa flexGrow/flexShrink và căn chip giữa hàng.
// Chip tách nhóm (vạch ngăn) dùng `self-stretch` để vẫn cao bằng chip.

import React from 'react';
import { ScrollView } from 'react-native';
import { Spacing } from '../../constants/theme';

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0, flexShrink: 0, marginBottom: Spacing.sm }}
      contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center' }}
    >
      {children}
    </ScrollView>
  );
}
