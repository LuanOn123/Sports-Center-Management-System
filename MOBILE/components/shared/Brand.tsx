// components/shared/Brand.tsx
// Logo nhận diện thương hiệu dùng chung — giống <Brand member /> của FE web
// (FE/src/shared/Brand.tsx + FE/public/brand/pulse-member.svg + shared/portal-theme.css)

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { Colors } from '../../constants/theme';

type BrandSize = 'sm' | 'md' | 'lg';

interface BrandProps {
  size?: BrandSize;
  align?: 'center' | 'flex-start';
}

// md = đúng kích thước portal web (khung 42, ảnh 36, chữ 24, tagline 9)
const SIZES: Record<BrandSize, { box: number; mark: number; title: number; tagline: number; gap: number }> = {
  sm: { box: 34, mark: 29, title: 20, tagline: 7.5, gap: 8 },
  md: { box: 42, mark: 36, title: 24, tagline: 9, gap: 10 },
  lg: { box: 50, mark: 43, title: 30, tagline: 10.5, gap: 12 },
};

/** Biểu tượng "M + nhịp tim" — vẽ lại 1-1 từ pulse-member.svg (viewBox 40x40) */
function PulseMark({ size }: { size: number }) {
  const { ink, accent, pulse } = Colors.brand;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Rect width={40} height={40} rx={10} fill={ink} />
      <Path d="M12 26V14L20 22L28 14V26" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={20} cy={11} r={2.5} fill={accent} />
      <Path d="M8 20L11 20M29 20L32 20" stroke={pulse} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function Brand({ size = 'md', align = 'center' }: BrandProps) {
  const s = SIZES[size];
  const { markBg, markBorder, accent, text, tagline } = Colors.brand;

  return (
    <View className="justify-center" style={{ alignItems: align }}>
      <View className="flex-row items-center" style={{ gap: s.gap }}>
        <View
          className="items-center justify-center rounded-md border"
          style={{ width: s.box, height: s.box, backgroundColor: markBg, borderColor: markBorder }}
        >
          <PulseMark size={s.mark} />
        </View>

        <View className="justify-center">
          <Text className="font-bevn-bold" style={{ color: text, fontSize: s.title, letterSpacing: -0.8, lineHeight: s.title * 1.1 }}>
            PULSE<Text style={{ color: accent }}>.</Text>
          </Text>
          <Text className="font-bevn-medium" style={{ color: tagline, fontSize: s.tagline, letterSpacing: 1.4, marginTop: 2 }}>
            SPORTS CENTER
          </Text>
        </View>
      </View>
    </View>
  );
}
