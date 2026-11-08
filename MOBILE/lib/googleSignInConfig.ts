// lib/googleSignInConfig.ts
// Cấu hình Google Sign-In đọc từ biến môi trường (xem .env.example).
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID PHẢI là Web client ID dùng chung với web (VITE_GOOGLE_CLIENT_ID) và BE (GOOGLE_CLIENT_ID):
// BE chỉ nhận ID token có audience đúng giá trị này, và thư viện chỉ trả ID token khi cấu hình webClientId loại Web.

export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

/** Chỉ iOS cần (OAuth client loại iOS của bundle com.pulsecenter.mobile); Android chọn client theo package + SHA-1 trên Google Cloud */
export const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';
