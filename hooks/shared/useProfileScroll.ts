// hooks/shared/useProfileScroll.ts
// Màn Thông tin cá nhân: khi một ô nhập được chạm thì cuộn tới ô đó để bàn phím không che, và nới đáy trang khi bàn phím mở.
// Web dùng scrollIntoView trên chính ô; di động cuộn tới vị trí đã đo sẵn theo tên ô (constants/profile).

import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { PROFILE_FIELD_SCROLL_DEFAULT, PROFILE_FIELD_SCROLL_DELAY_MS, PROFILE_FIELD_SCROLL_OFFSETS } from '../../constants/profile';

type InputRef = React.RefObject<any>;

export function useProfileScroll() {
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const inputRefs = useRef<Record<string, InputRef>>({});
  const [isInputFocused, setIsInputFocused] = useState(false);

  const getInputRef = (key: string): InputRef => {
    if (!inputRefs.current[key]) inputRefs.current[key] = React.createRef();
    return inputRefs.current[key];
  };

  // Hết nhập thì thu lại phần đệm đáy trang
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleFocusOut = () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) setIsInputFocused(false);
        }, 100);
      };
      window.addEventListener('focusout', handleFocusOut);
      return () => window.removeEventListener('focusout', handleFocusOut);
    }
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(hideEvent, () => setIsInputFocused(false));
    return () => sub.remove();
  }, []);

  const handleFocus = (fieldKey: string, e?: { target?: unknown }) => {
    setIsInputFocused(true);
    // Web: cuộn mượt tới chính ô đang nhập
    if (Platform.OS === 'web') {
      const ref = inputRefs.current[fieldKey]?.current;
      const target = (e?.target as HTMLElement | undefined) || ref?.node || ref;
      if (target && typeof target.scrollIntoView === 'function') {
        setTimeout(() => {
          try {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {}
        }, PROFILE_FIELD_SCROLL_DELAY_MS);
        return;
      }
    }
    // iOS / Android: cuộn tới vị trí đã đo để ô đang nhập nằm giữa vùng nhìn thấy
    const targetOffset = PROFILE_FIELD_SCROLL_OFFSETS[fieldKey] ?? PROFILE_FIELD_SCROLL_DEFAULT;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: targetOffset, animated: true });
    }, PROFILE_FIELD_SCROLL_DELAY_MS);
  };

  return { scrollViewRef, isInputFocused, getInputRef, handleFocus };
}
