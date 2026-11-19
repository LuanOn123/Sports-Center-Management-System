import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Gọi rung phản hồi kiểu "bắn rồi quên": các hàm của expo-haptics là async, khi thiếu module native
 * (vd. Expo Go không có, hoặc máy không hỗ trợ) chúng trả về promise bị reject chứ không ném lỗi ngay —
 * try/catch thường không bắt được và sinh lỗi "Uncaught (in promise)". Bắt cả hai trường hợp, không bao giờ làm crash.
 */
export function fireHaptic(run: () => Promise<unknown>) {
  if (Platform.OS === 'web') return;
  try {
    void run().catch(() => {});
  } catch {}
}

/**
 * Tiện ích rung phản hồi (Haptic Feedback) chuẩn trải nghiệm người dùng cao cấp:
 * Tự động bỏ qua an toàn trên Web hoặc khi thiết bị / Expo Go không có module rung.
 */
export const Haptic = {
  /** Chạm nhẹ: chuyển tab, chọn filter, click nút phụ */
  light: () => fireHaptic(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)),

  /** Chạm vừa: bấm nút CTA (Đặt lịch, Đăng nhập, Gửi tin nhắn) */
  medium: () => fireHaptic(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)),

  /** Chạm mạnh: hủy gói, xóa, hành động quan trọng */
  heavy: () => fireHaptic(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy)),

  /** Rung chọn: click picker, chuyển segmented control, switch tab */
  selection: () => fireHaptic(() => ExpoHaptics.selectionAsync()),

  /** Báo thành công: Điểm danh thành công, Đặt lịch hoàn tất */
  success: () => fireHaptic(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),

  /** Báo lỗi: Sai mật khẩu, Hết hạn, Lỗi kết nối */
  error: () => fireHaptic(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error)),

  /** Báo cảnh báo: Cảnh báo chuyên cần, Sắp hết hạn */
  warning: () => fireHaptic(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)),
};
