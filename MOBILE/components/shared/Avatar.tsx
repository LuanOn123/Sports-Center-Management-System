// components/shared/Avatar.tsx
// Ảnh đại diện — hiện ảnh thật nếu có avatarUrl, fallback về chữ cái đầu tên.

import React from 'react';
import { View, Text, Image } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const letter = name?.trim()?.charAt(0)?.toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      className="bg-primary justify-center items-center"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text
        className="font-bold font-bevn-bold text-text-inverse"
        style={{ fontSize: size * 0.45 }}
      >
        {letter}
      </Text>
    </View>
  );
}
