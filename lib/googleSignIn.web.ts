// lib/googleSignIn.web.ts
// Bản web của lib/googleSignIn.ts: thư viện Google native không chạy trên web nên chỉ báo "chưa dùng được".
// Giữ cùng các hàm để màn hình không phải rẽ nhánh theo nền tảng.

import { GOOGLE_TEXT } from '../constants/auth';
import type { GoogleSignInOutcome, GoogleUnavailableReason } from './googleSignInTypes';

export type { GoogleAccount, GoogleSignInOutcome, GoogleUnavailableReason } from './googleSignInTypes';

export function googleSignInUnavailableReason(): GoogleUnavailableReason | null {
  return 'web';
}

export async function signInWithGoogle(): Promise<GoogleSignInOutcome> {
  throw new Error(GOOGLE_TEXT.unavailable.web);
}

export async function signOutOfGoogle(): Promise<void> {}

export function googleErrorMessage(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : GOOGLE_TEXT.loginFailedFallback;
}
