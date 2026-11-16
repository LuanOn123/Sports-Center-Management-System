// navigation/stackOptions.ts
// Vuốt từ trái sang phải để quay lại trang trước — dùng chung cho MỌI Stack của app: Stack gốc (app/_layout.tsx) và các Stack
// lồng nhau (auth, chat, member, coach). Mỗi layout rải SWIPE_BACK_OPTIONS vào screenOptions; tests/mobile-contract.test.cjs quét
// app/**/_layout.tsx để không Stack nào (kể cả Stack thêm sau này) bị sót, và cấm màn nào tự tắt cử chỉ.
//
//  - iOS: gestureEnabled mặc định đã bật nhưng chỉ nhận ở mép trái màn hình; iOS 18 trở xuống KHÔNG nhận ở giữa màn hình
//    (chỉ iOS 26 trở lên mới tự bật). fullScreenGestureEnabled cho vuốt ở bất kỳ chỗ nào trên màn hình.
//  - Android: không có hai tuỳ chọn này; cử chỉ quay lại của hệ thống (vuốt từ mép) đi qua nút Back và expo-router tự pop màn hình.
//  - Màn đầu tiên của Stack (vd. các tab) không có trang trước nên vuốt không làm gì.

import type { NativeStackNavigationOptions } from 'expo-router';

export const SWIPE_BACK_OPTIONS = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const satisfies NativeStackNavigationOptions;
