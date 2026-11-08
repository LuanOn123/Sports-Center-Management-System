// lib/googleSignInTypes.ts
// Kiểu dùng chung cho lib/googleSignIn.ts (native) và lib/googleSignIn.web.ts (bản rỗng cho web)

/**
 * Vì sao chưa dùng được Google: web không có · Expo Go không chứa module native · thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ·
 * bản cài chưa gắn thư viện Google (development build cũ cần build lại)
 */
export type GoogleUnavailableReason = 'web' | 'expo-go' | 'not-configured' | 'native-module-missing';

/** Tài khoản Google vừa chọn: ID token (gửi BE) cùng tên, email, ảnh để hiển thị ở bước hoàn tất đăng ký */
export interface GoogleAccount {
  idToken: string;
  email: string;
  name: string | null;
  photo: string | null;
}

export type GoogleSignInOutcome = ({ status: 'success' } & GoogleAccount) | { status: 'cancelled' };
