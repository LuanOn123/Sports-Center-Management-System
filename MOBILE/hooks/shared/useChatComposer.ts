// hooks/shared/useChatComposer.ts
// Ô soạn tin của một cuộc trò chuyện: nội dung, tệp đính kèm (ảnh / PDF ≤ 10 MB), gửi một lần (chặn bấm dồn)

import { useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { CHAT_FILE_ERROR, CHAT_FILE_MAX_BYTES, CHAT_FILE_TYPES, CHAT_TEXT } from '../../constants/chat';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import type { User } from '../../lib/types';

type SendMessage = (content: string, user?: User | null, attachment?: DocumentPicker.DocumentPickerAsset) => Promise<unknown>;

/** `initialText`: tin soạn sẵn (vd. câu chào lễ tân về hoàn tiền); chỉ điền lúc mở, người dùng sửa hoặc xóa tùy ý */
export function useChatComposer(send: SendMessage, user: User | null, initialText = '') {
  const [text, setText] = useState(initialText);
  const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset>();
  const [sending, setSending] = useState(false);
  // Bản sao đồng bộ để Enter / nút gửi bấm dồn không gửi trùng và luôn đọc đúng nội dung mới nhất
  const textRef = useRef(initialText);
  const sendingRef = useRef(false);

  const changeText = (value: string) => {
    setText(value);
    textRef.current = value;
  };

  const submit = async () => {
    const trimmed = textRef.current.trim();
    if ((!trimmed && !attachment) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    Haptic.medium();
    // Xóa ô soạn NGAY khi bấm gửi (tin đã hiện lạc quan trong khung chat). Đợi BE trả lời mới xóa thì trên Android
    // ô nhiều dòng thường giữ nguyên chữ cũ; gửi lỗi thì trả lại nội dung (nếu người dùng chưa gõ gì mới) để gửi lại
    const sentText = textRef.current;
    const sentAttachment = attachment;
    textRef.current = '';
    setText('');
    setAttachment(undefined);
    try {
      await send(trimmed, user, sentAttachment);
    } catch (e) {
      if (!textRef.current) {
        textRef.current = sentText;
        setText(sentText);
      }
      setAttachment((current) => current ?? sentAttachment);
      showAlert(CHAT_TEXT.sendFailed, e instanceof Error ? e.message : CHAT_TEXT.retryHint);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const pickAttachment = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: CHAT_FILE_TYPES, copyToCacheDirectory: true, multiple: false });
      if (picked.canceled) return;
      const file = picked.assets[0];
      if (file.size != null && file.size > CHAT_FILE_MAX_BYTES) {
        showAlert(CHAT_TEXT.fileTooLarge, CHAT_FILE_ERROR.tooLarge);
        return;
      }
      setAttachment(file);
    } catch (e) {
      showAlert(CHAT_TEXT.pickFailed, e instanceof Error ? e.message : CHAT_TEXT.retryHint);
    }
  };

  return {
    text,
    changeText,
    attachment,
    removeAttachment: () => setAttachment(undefined),
    sending,
    canSend: Boolean(text.trim() || attachment),
    submit,
    pickAttachment,
  };
}
