// components/assistant/AssistantChatView.tsx
// Màn chat với trợ lý AI (mở từ bong bóng nổi hoặc từ menu): lời chào, câu hỏi gợi ý, dòng hội thoại, "AI đang gõ…"
// và thanh nhập cố định dưới đáy. Trạng thái cuộc trò chuyện nằm ở context (không mất khi thoát ra rồi vào lại).

import React, { useEffect, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, type ScrollViewInstance } from 'react-native';
import { AssistantComposer } from './AssistantComposer';
import { AssistantMessageItem } from './AssistantMessageItem';
import { AssistantSuggestions } from './AssistantSuggestions';
import { AssistantTyping } from './AssistantTyping';
import { Icon } from '../shared/Icon';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { ScreenHeader } from '../shared/ScreenHeader';
import { ASSISTANT_GREETING, ASSISTANT_NAME, ASSISTANT_TEXT, suggestionsForRole } from '../../constants/assistant';
import { Colors, Spacing } from '../../constants/theme';
import { useAssistant } from '../../context/AssistantContext';
import { useAuth } from '../../context/AuthContext';
import { useAssistantComposer } from '../../hooks/shared/useAssistantComposer';
import { showConfirm } from '../../lib/alert';

const GREETING = { id: 'greeting', role: 'assistant' as const, content: ASSISTANT_GREETING };

export function AssistantChatView() {
  const { user } = useAuth();
  const { messages, pending, send, retry, stop, reset, setViewing } = useAssistant();
  const composer = useAssistantComposer({ send, pending });
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Đang mở màn chat thì câu trả lời mới không tính là "chưa đọc" trên bong bóng
  useEffect(() => {
    setViewing(true);
    return () => setViewing(false);
  }, [setViewing]);

  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  const askNewChat = () =>
    showConfirm(
      ASSISTANT_TEXT.newChatConfirmTitle,
      ASSISTANT_TEXT.newChatConfirmMessage,
      reset,
      undefined,
      ASSISTANT_TEXT.newChatConfirmAction,
      true,
    );

  const newChatAction =
    messages.length > 0 ? (
      <TouchableOpacity
        onPress={askNewChat}
        accessibilityRole="button"
        accessibilityLabel={ASSISTANT_TEXT.newChat}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="add" size={24} color={Colors.primary} />
      </TouchableOpacity>
    ) : undefined;

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScreenHeader title={ASSISTANT_NAME} rightAction={newChatAction} />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={scrollToEnd}
        onLayout={scrollToEnd}
      >
        <AssistantMessageItem message={GREETING} isGreeting />
        {messages.length === 0 ? (
          <>
            <AssistantSuggestions suggestions={suggestionsForRole(user?.role)} onPick={(text) => composer.submit(text)} disabled={pending} />
            <Text className="text-xs font-bevn-regular text-text-muted">{ASSISTANT_TEXT.privacy}</Text>
          </>
        ) : null}
        {messages.map((message) => (
          <AssistantMessageItem key={message.id} message={message} canRetry={!pending} onRetry={retry} />
        ))}
        {pending ? <AssistantTyping /> : null}
      </ScrollView>
      <AssistantComposer composer={composer} pending={pending} onStop={stop} />
    </KeyboardAwareView>
  );
}
