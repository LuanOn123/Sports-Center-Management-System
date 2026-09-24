// components/shared/Brand.tsx
// Logo nhận diện thương hiệu dùng chung

import React from 'react';
import { View, Text } from 'react-native';
import clsx from 'clsx';
import { Icon } from './Icon';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  align?: 'center' | 'flex-start';
}

export function Brand({ size = 'md', align = 'center' }: BrandProps) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const iconSize = isLg ? 28 : isSm ? 18 : 24;

  return (
    <View className="justify-center" style={{ alignItems: align }}>
      <View className="flex-row items-center gap-[10px]">
        <View
          className={clsx(
            'items-center justify-center bg-primary -skew-x-6',
            isLg ? 'w-11 h-12 rounded-md' : isSm ? 'w-[30px] h-[34px] rounded-lg' : 'w-[38px] h-[42px] rounded-lg'
          )}
        >
          <Icon name="show-chart" size={iconSize} color="#223528" />
        </View>

        <View className="justify-center">
          <Text
            className={clsx(
              'font-extrabold font-bevn-extrabold text-[#F3F7F1] -tracking-[1.5px]',
              isLg ? 'text-[36px]' : isSm ? 'text-[22px]' : 'text-[30px]'
            )}
          >
            pulse<Text className="text-primary">.</Text>
          </Text>
          <Text
            className={clsx(
              'font-semibold font-bevn-semibold text-[#A1B0A4] mt-0.5',
              isLg ? 'text-[8.5px] tracking-[2.8px]' : isSm ? 'text-[6.5px] tracking-[1.8px]' : 'text-[7.5px] tracking-[2.3px]'
            )}
          >
            SPORTS CENTER
          </Text>
        </View>
      </View>
    </View>
  );
}
