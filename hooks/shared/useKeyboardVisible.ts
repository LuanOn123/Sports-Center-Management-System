// hooks/shared/useKeyboardVisible.ts
// Bàn phím ảo đang mở? Dùng để ẩn thanh tab khi gõ. Web không có sự kiện bàn phím ảo nên coi "đang gõ" là có ô nhập đang được
// focus; iOS dùng sự kiện "will" cho mượt, Android dùng "did". (Cần cả toạ độ bàn phím thì dùng useKeyboard.)

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

const WEB_TEXT_INPUT_TAGS = ['INPUT', 'TEXTAREA'];

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (WEB_TEXT_INPUT_TAGS.includes(target.tagName) || target.getAttribute('contenteditable') === 'true')) setVisible(true);
      };
      const handleFocusOut = () => setVisible(false);
      window.addEventListener('focusin', handleFocusIn);
      window.addEventListener('focusout', handleFocusOut);
      return () => {
        window.removeEventListener('focusin', handleFocusIn);
        window.removeEventListener('focusout', handleFocusOut);
      };
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
