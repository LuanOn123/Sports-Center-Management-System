// hooks/shared/useKeyboard.ts
// Trạng thái bàn phím ảo: đang mở hay không + toạ độ mép trên (screenY) để tính phần màn hình
// còn nhìn thấy. iOS dùng sự kiện "will" cho mượt, Android dùng "did". Web không có sự kiện → đóng.

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboard() {
  const [state, setState] = useState({ visible: false, top: 0 });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setState({ visible: true, top: e.endCoordinates.screenY }));
    const hide = Keyboard.addListener(hideEvent, () => setState({ visible: false, top: 0 }));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}
