// components/assistant/AssistantComposer.tsx
// Thanh nhập dưới đáy màn chat AI: ô nhiều dòng + nút Gửi (đổi thành nút Dừng khi đang chờ câu trả lời) + bộ đếm ký tự.

import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import clsx from 'clsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../shared/Icon';
import { ASSISTANT_TEXT } from '../../constants/assistant';
import { Colors } from '../../constants/theme';
import { useKeyboard } from '../../hooks/shared/useKeyboard';
import type { useAssistantComposer } from '../../hooks/shared/useAssistantComposer';

interface Props {
  composer: ReturnType<typeof useAssistantComposer>;
  pending: boolean;
  onStop: () => void;
}

export function AssistantComposer({ composer, pending, onStop }: Props) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();
  const atLimit = composer.draft.length >= composer.maxLength;

  return (
    <View
      className="px-lg pt-md border-t border-border"
      style={{ paddingBottom: keyboard.visible ? 12 : Math.max(insets.bottom, 12), backgroundColor: Colors.bg.surface }}
    >
      <View className="flex-row items-end gap-sm">
        <TextInput
          className="flex-1 bg-bg-elevated rounded-lg px-lg py-sm text-text-primary font-bevn-regular text-md max-h-[120px] border border-border"
          value={composer.draft}
          onChangeText={composer.setDraft}
          placeholder={ASSISTANT_TEXT.inputPlaceholder}
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={composer.maxLength}
          returnKeyType="default"
          onKeyPress={composer.onKeyPress}
          accessibilityLabel={ASSISTANT_TEXT.inputPlaceholder}
        />
        {pending ? (
          <TouchableOpacity
            className="w-10 h-10 rounded-full justify-center items-center bg-bg-elevated border border-border"
            onPress={onStop}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={ASSISTANT_TEXT.stop}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: Colors.text.primary }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className={clsx('w-10 h-10 rounded-full justify-center items-center', composer.canSend ? 'bg-primary' : 'bg-bg-elevated')}
            onPress={() => composer.submit()}
            disabled={!composer.canSend}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={ASSISTANT_TEXT.send}
            accessibilityState={{ disabled: !composer.canSend }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="send" size={20} color={composer.canSend ? Colors.text.inverse : Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>
      {composer.counter ? (
        <Text className="self-end mt-xs text-xs font-bevn-regular" style={{ color: atLimit ? Colors.status.failed : Colors.text.muted }}>
          {composer.counter}
        </Text>
      ) : null}
    </View>
  );
}
