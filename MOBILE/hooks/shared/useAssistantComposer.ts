// hooks/shared/useAssistantComposer.ts
// Ô nhập của màn chat AI: nội dung đang gõ, bộ đếm ký tự, gửi (xóa ô khi tin được nhận) và Enter để gửi trên web.

import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { ASSISTANT_MAX_MESSAGE_LENGTH } from '../../constants/assistant';
import { checkDraft, counterLabel } from '../../lib/aiChat';
import { Haptic } from '../../lib/haptics';

interface Options {
  /** Gửi tin; trả về true khi tin đã được nhận */
  send: (text: string) => boolean;
  pending: boolean;
}

export function useAssistantComposer({ send, pending }: Options) {
  const [draft, setDraft] = useState('');

  const check = checkDraft(draft);
  const canSend = check.ok && !pending;

  const submit = useCallback(
    (override?: string) => {
      const text = override ?? draft;
      if (pending || !send(text)) return;
      Haptic.light();
      // Gửi câu gợi ý không đụng tới chữ người dùng đang soạn dở
      if (override === undefined) setDraft('');
    },
    [draft, pending, send],
  );

  /** Web: Enter gửi, Shift+Enter xuống dòng (trên điện thoại Enter là xuống dòng, gửi bằng nút) */
  const onKeyPress = useCallback(
    (event: { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void }) => {
      if (Platform.OS !== 'web' || event.nativeEvent.key !== 'Enter' || event.nativeEvent.shiftKey) return;
      event.preventDefault?.();
      submit();
    },
    [submit],
  );

  return {
    draft,
    setDraft,
    canSend,
    submit,
    onKeyPress,
    counter: counterLabel(draft.length),
    maxLength: ASSISTANT_MAX_MESSAGE_LENGTH,
  };
}
