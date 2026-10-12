import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, ActivityIndicator } from 'react-native';
import { Brand } from './Brand';
import { Colors } from '../../constants/theme';

interface AppLoadingScreenProps {
  message?: string;
}

export function AppLoadingScreen({ message = 'Đang khởi động ứng dụng...' }: AppLoadingScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.5,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, opacityAnim]);

  return (
    <View className="flex-1 bg-bg-primary justify-center items-center px-xl">
      {/* Background radial glow effect */}
      <View className="absolute w-72 h-72 rounded-full bg-[#A3E63508] blur-3xl" />

      {/* Branded Logo with Pulse */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="items-center mb-xl">
        <Brand size="lg" />
      </Animated.View>

      {/* Loading Spinner & Message */}
      <View className="items-center mt-lg">
        <ActivityIndicator color={Colors.primary} size="large" />
        <Animated.Text
          style={{ opacity: opacityAnim }}
          className="text-text-secondary text-sm font-bevn-medium mt-md text-center"
        >
          {message}
        </Animated.Text>
      </View>

      {/* Bottom Version / Center Name */}
      <View className="absolute bottom-10 items-center">
        <Text className="text-text-muted text-xs font-bevn-regular">Trung tâm thể thao cao cấp</Text>
      </View>
    </View>
  );
}
