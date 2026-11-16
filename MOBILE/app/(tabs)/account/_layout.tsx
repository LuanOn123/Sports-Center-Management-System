// app/(tabs)/account/_layout.tsx
// Tab Tài khoản là một Stack lồng nhau: menu Tài khoản (index) → Thông tin cá nhân & bảo mật (profile).
// Nhờ vậy khi vào Thông tin cá nhân thanh tab vẫn hiện, tab Tài khoản vẫn sáng và vuốt từ trái sang phải để quay lại menu được
// (nếu Thông tin cá nhân là một tab ẩn thì không có "trang trước" để vuốt và không tab nào sáng).

import { Stack } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { SWIPE_BACK_OPTIONS } from '../../../navigation/stackOptions';

// Vào thẳng Thông tin cá nhân (vd. từ Hướng dẫn sử dụng) vẫn có menu Tài khoản bên dưới để quay lại
export const unstable_settings = { anchor: 'index' };

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg.primary },
        ...SWIPE_BACK_OPTIONS,
      }}
    />
  );
}
