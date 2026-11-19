// lib/googleCodeScanner.ts
// Quét QR bằng trình quét của Google (Google code scanner — cùng bộ máy với Google Lens) qua expo-camera
// `CameraView.launchScanner`. Trên Android, camera tự dựng trong app (CameraView + onBarcodeScanned) không đọc được
// mã điểm danh dày đặc (JWT ~280 ký tự) trong khi Lens đọc được; trình quét của Google tự phóng to/lấy nét nên ổn định hơn,
// và không cần app xin quyền camera. Thiếu Google Play Services → 'unavailable' để màn quét quay về camera trong app.

import { Platform } from 'react-native';
import { CameraView } from 'expo-camera';

export type GoogleScanOutcome =
  | { status: 'scanned'; data: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

/** Thư viện gửi sự kiện kết quả rồi mới resolve promise, nhưng hai kênh không đảm bảo thứ tự → chờ thêm chừng này */
export const GOOGLE_SCAN_RESULT_GRACE_MS = 1500;

export function googleCodeScannerAvailable() {
  return Platform.OS === 'android' && CameraView.isModernBarcodeScannerAvailable === true;
}

/** Mở trình quét của Google; trả nội dung mã QR, hoặc người dùng đã đóng, hoặc máy không dùng được */
export async function scanQrWithGoogle(): Promise<GoogleScanOutcome> {
  if (!googleCodeScannerAvailable()) return { status: 'unavailable' };

  let resolveScan: (data: string) => void = () => {};
  const scanned = new Promise<string>((resolve) => { resolveScan = resolve; });
  const subscription = CameraView.onModernBarcodeScanned((event) => {
    if (event?.data) resolveScan(event.data);
  });
  try {
    try {
      await CameraView.launchScanner({ barcodeTypes: ['qr'] });
    } catch (error) {
      // Người dùng bấm quay lại → "Barcode scanning was cancelled"; lỗi khác (thiếu Play Services, MLKit…) → dùng camera trong app
      const message = error instanceof Error ? error.message : String(error);
      return /cancel/i.test(message) ? { status: 'cancelled' } : { status: 'unavailable' };
    }
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), GOOGLE_SCAN_RESULT_GRACE_MS));
    const data = await Promise.race([scanned, timeout]);
    return data ? { status: 'scanned', data } : { status: 'cancelled' };
  } finally {
    subscription.remove();
  }
}
