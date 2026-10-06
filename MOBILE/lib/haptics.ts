import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Tiện ích rung phản hồi (Haptic Feedback) chuẩn trải nghiệm người dùng cao cấp:
 * Tự động vô hiệu hóa an toàn trên Web để không gây crash.
 */
export const Haptic = {
  /** Chạm nhẹ: chuyển tab, chọn filter, click nút phụ */
  light: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  },

  /** Chạm vừa: bấm nút CTA (Đặt lịch, Đăng nhập, Gửi tin nhắn) */
  medium: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  },

  /** Chạm mạnh: hủy gói, xóa, hành động quan trọng */
  heavy: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }
  },

  /** Rung chọn: click picker, chuyển segmented control, switch tab */
  selection: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.selectionAsync();
      } catch {}
    }
  },

  /** Báo thành công: Điểm danh thành công, Đặt lịch hoàn tất */
  success: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
      } catch {}
    }
  },

  /** Báo lỗi: Sai mật khẩu, Hết hạn, Lỗi kết nối */
  error: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
      } catch {}
    }
  },

  /** Báo cảnh báo: Cảnh báo chuyên cần, Sắp hết hạn */
  warning: () => {
    if (Platform.OS !== 'web') {
      try {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
      } catch {}
    }
  },
};
