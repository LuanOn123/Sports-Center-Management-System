// components/assistant/AssistantMessageItem.tsx
// Một dòng trong cuộc trò chuyện: tin của người dùng (nền lime, bên phải) hoặc câu trả lời của trợ lý (Markdown, bên trái).
// Tin chưa được trả lời hiện lý do và nút "Gửi lại"; câu trả lời có nút "Sao chép".

import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import clsx from 'clsx';
import { AssistantMarkdown } from './AssistantMarkdown';
import { Icon } from '../shared/Icon';
import { ASSISTANT_TEXT } from '../../constants/assistant';
import { Colors } from '../../constants/theme';
import type { ChatMessage } from '../../lib/aiChat';
import { markdownToPlainText } from '../../lib/assistantMarkdown';
import { showAlert } from '../../lib/alert';
import { copyToClipboard } from '../../lib/device';
import { Haptic } from '../../lib/haptics';

const COPIED_MS = 1500;

interface Props {
  message: Pick<ChatMessage, 'id' | 'role' | 'content' | 'status' | 'error'>;
  /** Lời chào mở đầu: không có nút sao chép */
  isGreeting?: boolean;
  /** Cho phép gửi lại (tắt khi đang chờ câu trả lời khác) */
  canRetry?: boolean;
  onRetry?: (id: string) => void;
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    Haptic.light();
    const ok = await copyToClipboard(markdownToPlainText(content));
    if (!ok) {
      showAlert('Không sao chép được', 'Vui lòng giữ và chọn chữ để sao chép.');
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <TouchableOpacity
      className="flex-row items-center gap-xs self-start py-xs"
      onPress={() => { void copy(); }}
      accessibilityRole="button"
      accessibilityLabel={ASSISTANT_TEXT.copy}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name={copied ? 'check-circle-outline' : 'content-copy'} size={13} color={copied ? Colors.status.success : Colors.text.muted} />
      <Text className="text-xs font-bevn-regular" style={{ color: copied ? Colors.status.success : Colors.text.muted }}>
        {copied ? ASSISTANT_TEXT.copied : ASSISTANT_TEXT.copy}
      </Text>
    </TouchableOpacity>
  );
}

export function AssistantMessageItem({ message, isGreeting = false, canRetry = true, onRetry }: Props) {
  if (message.role === 'assistant') {
    return (
      <View className="self-start max-w-[92%] gap-xs">
        <View className="rounded-lg rounded-bl-sm border border-border bg-bg-surface px-md py-sm">
          <AssistantMarkdown content={message.content} />
        </View>
        {isGreeting ? null : <CopyButton content={message.content} />}
      </View>
    );
  }

  const failed = message.status === 'failed';
  return (
    <View className="self-end max-w-[85%] gap-xs items-end">
      <View className={clsx('rounded-lg rounded-br-sm bg-primary px-md py-sm', failed && 'opacity-80 border border-status-failed')}>
        <Text selectable className="text-md leading-[22px] font-bevn-regular text-text-inverse">{message.content}</Text>
      </View>
      {failed ? (
        <View className="flex-row items-center gap-sm">
          <Icon name="error-outline" size={14} color={Colors.status.failed} />
          <Text className="flex-shrink text-xs font-bevn-regular text-status-failed">{message.error}</Text>
          {onRetry ? (
            <TouchableOpacity
              disabled={!canRetry}
              onPress={() => { Haptic.light(); onRetry(message.id); }}
              accessibilityRole="button"
              accessibilityLabel={ASSISTANT_TEXT.retry}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className={clsx('flex-row items-center gap-xs rounded-full border border-border px-sm py-xs', !canRetry && 'opacity-40')}
            >
              <Icon name="refresh" size={13} color={Colors.primary} />
              <Text className="text-xs font-bevn-medium text-primary">{ASSISTANT_TEXT.retry}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
