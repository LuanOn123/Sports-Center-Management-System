import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleProp, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 6, style, className }: SkeletonProps) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: '#27342B',
          opacity: opacityAnim,
        },
        style,
      ]}
      className={className}
    />
  );
}

export function ClassCardSkeleton() {
  return (
    <View className="bg-bg-surface rounded-xl p-lg mb-md border border-border">
      <View className="flex-row justify-between items-center mb-md">
        <Skeleton width={100} height={20} borderRadius={6} />
        <Skeleton width={60} height={20} borderRadius={10} />
      </View>
      <Skeleton width="80%" height={24} borderRadius={6} className="mb-sm" />
      <Skeleton width="50%" height={16} borderRadius={4} className="mb-md" />
      <View className="flex-row gap-sm pt-sm border-t border-border">
        <Skeleton width={80} height={16} borderRadius={4} />
        <Skeleton width={80} height={16} borderRadius={4} />
      </View>
    </View>
  );
}
