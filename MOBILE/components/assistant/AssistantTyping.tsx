// components/assistant/AssistantTyping.tsx
// "AI đang gõ…": ba chấm nhấp nháy lần lượt trong bong bóng của trợ lý (giống web hiện chữ khi chờ trả lời).

import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { ASSISTANT_TEXT } from '../../constants/assistant';
import { Colors } from '../../constants/theme';

const CYCLE_MS = 1200;
const STEP_MS = 300;
const STAGGER_MS = 150;

function Dot({ index }: { index: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const delay = index * STAGGER_MS;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: STEP_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: STEP_MS, useNativeDriver: true }),
        Animated.delay(CYCLE_MS - 2 * STEP_MS - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index, opacity]);

  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.text.secondary, opacity }} />;
}

export function AssistantTyping() {
  return (
    <View
      className="self-start flex-row items-center gap-sm rounded-lg rounded-bl-sm border border-border bg-bg-surface px-md py-sm"
      accessibilityRole="progressbar"
      accessibilityLabel={ASSISTANT_TEXT.typing}
    >
      <View className="flex-row items-center gap-xs">
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} />
        ))}
      </View>
      <Text className="text-sm font-bevn-regular text-text-secondary">{ASSISTANT_TEXT.typing}</Text>
    </View>
  );
}
