// constants/tabBar.ts
// Kích thước thanh tab dưới đáy và huy hiệu số tin chưa đọc

export const TAB_BAR = {
  /** Chiều cao thanh tab, chưa tính vùng an toàn phía dưới của máy */
  baseHeight: 60,
  /** Đệm dưới tối thiểu khi máy không có vùng an toàn */
  minBottomPadding: 8,
  paddingTop: 6,
  iconSize: 22,
  labelSize: 11,
  labelLineHeight: 15,
  labelGap: 2,
  labelFont: 'BeVietnamPro_500Medium',
} as const;

/** Huy hiệu số: vượt mức này thì hiện "99+" */
export const TAB_BADGE_MAX = 99;
