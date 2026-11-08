// lib/googleRegistration.ts
// Giữ tạm tài khoản Google vừa chọn giữa màn đăng nhập/đăng ký và màn "Hoàn tất đăng ký Google".
// Chỉ nằm trong bộ nhớ (ID token không đi qua tham số URL, không ghi ra máy) và mất khi mở lại app — lúc đó người dùng chọn lại Google.

import type { GoogleAccount } from './googleSignInTypes';

let pending: GoogleAccount | null = null;

export const holdGoogleAccount = (account: GoogleAccount) => {
  pending = account;
};

export const peekGoogleAccount = () => pending;

export const clearGoogleAccount = () => {
  pending = null;
};
