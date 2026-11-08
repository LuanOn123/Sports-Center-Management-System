// lib/googleSignIn.ts
// Đăng nhập Google bản Android/iOS (@react-native-google-signin/google-signin) lấy ID token gửi BE
// (POST /auth/google-login | /auth/google-register — BE xác thực bằng GOOGLE_CLIENT_ID).
//
// Thư viện được nạp LƯỜI bên trong hàm, KHÔNG import ở đầu file: nó đòi module native RNGoogleSignin ngay khi import,
// nên import sẵn sẽ làm sập cả app khi chạy Expo Go hoặc bản cài chưa gắn Google (cùng cách lib/device.ts).
// Bản web dùng lib/googleSignIn.web.ts.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GOOGLE_TEXT } from '../constants/auth';
import { googleIosClientId, googleWebClientId } from './googleSignInConfig';
import type { GoogleSignInOutcome, GoogleUnavailableReason } from './googleSignInTypes';

export type { GoogleAccount, GoogleSignInOutcome, GoogleUnavailableReason } from './googleSignInTypes';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let loaded: GoogleSigninModule | null | undefined;
let configured = false;

function nativeModule(): GoogleSigninModule | null {
  if (loaded === undefined) {
    try {
      loaded = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    } catch {
      loaded = null;
    }
  }
  return loaded ?? null;
}

/** null nếu dùng được; ngược lại là lý do để báo người dùng (nút vẫn hiện, bấm vào sẽ giải thích) */
export function googleSignInUnavailableReason(): GoogleUnavailableReason | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  if (!googleWebClientId) return 'not-configured';
  return nativeModule() ? null : 'native-module-missing';
}

/** Mở bảng chọn tài khoản Google và trả ID token; người dùng đóng bảng chọn → { status: 'cancelled' } */
export async function signInWithGoogle(): Promise<GoogleSignInOutcome> {
  const reason = googleSignInUnavailableReason();
  const native = nativeModule();
  if (reason || !native) throw new Error(GOOGLE_TEXT.unavailable[reason ?? 'native-module-missing']);

  const { GoogleSignin } = native;
  if (!configured) {
    GoogleSignin.configure({ webClientId: googleWebClientId, ...(googleIosClientId ? { iosClientId: googleIosClientId } : {}) });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') return { status: 'cancelled' };

  const { idToken, user } = response.data;
  // Thư viện chỉ trả ID token khi webClientId đúng loại Web — null nghĩa là cấu hình Google Cloud/.env sai
  if (!idToken) throw new Error(GOOGLE_TEXT.noIdToken);
  return { status: 'success', idToken, email: user.email, name: user.name, photo: user.photo };
}

/** Quên tài khoản Google đã chọn để lần sau luôn hiện bảng chọn tài khoản (gọi khi đăng xuất / hủy đăng ký) */
export async function signOutOfGoogle(): Promise<void> {
  const native = nativeModule();
  if (!native) return;
  try {
    await native.GoogleSignin.signOut();
  } catch {
    // Chưa từng đăng nhập Google hoặc đã đăng xuất — không ảnh hưởng phiên của app
  }
}

/** Câu tiếng Việt cho lỗi của thư viện Google (không dùng cho ApiError của BE); null nếu người dùng tự hủy hoặc đang mở bảng chọn */
export function googleErrorMessage(error: unknown): string | null {
  const native = nativeModule();
  if (native && native.isErrorWithCode(error)) {
    const { statusCodes } = native;
    if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return null;
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return GOOGLE_TEXT.playServicesMissing;
  }
  return error instanceof Error && error.message ? error.message : GOOGLE_TEXT.loginFailedFallback;
}
