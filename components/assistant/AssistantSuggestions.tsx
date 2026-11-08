// components/assistant/AssistantSuggestions.tsx
// Câu hỏi gợi ý khi chưa có tin nhắn nào: chạm là gửi ngay.

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ASSISTANT_TEXT } from '../../constants/assistant';

interface Props {
  suggestions: readonly string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}

export function AssistantSuggestions({ suggestions, onPick, disabled }: Props) {
  return (
    <View className="gap-sm">
      <Text className="text-xs font-bevn-medium text-text-muted">{ASSISTANT_TEXT.suggestionsTitle}</Text>
      <View className="flex-row flex-wrap gap-sm">
        {suggestions.map((text) => (
          <TouchableOpacity
            key={text}
            disabled={disabled}
            onPress={() => onPick(text)}
            activeOpacity={0.7}
            accessibilityRole="button"
            className="max-w-full rounded-full border border-border bg-bg-surface px-md py-sm"
            style={disabled ? { opacity: 0.5 } : undefined}
          >
            <Text className="text-sm font-bevn-medium text-text-primary">{text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
