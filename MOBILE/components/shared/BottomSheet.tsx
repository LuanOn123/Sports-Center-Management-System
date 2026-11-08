// components/shared/BottomSheet.tsx
// Bảng trượt từ đáy cho form ngắn có ô nhập (đăng ký lớp, đánh giá tiến độ): tiêu đề + nội dung cuộn + vùng nút cố định.
// Tránh bàn phím, chạm nền hoặc nút đóng để thoát (bị chặn khi đang gửi dữ liệu).

import React, { type ReactNode } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { KeyboardAwareView } from './KeyboardAwareView';
import { Colors, Spacing } from '../../constants/theme';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  caption?: string;
  onClose: () => void;
  /** false khi đang gửi dữ liệu: chặn đóng để không mất thao tác giữa chừng */
  dismissible?: boolean;
  /** Vùng nút cố định dưới đáy */
  footer?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ visible, title, caption, onClose, dismissible = true, footer, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (dismissible) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAwareView className="flex-1">
        <View className="flex-1 bg-overlay">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={close} accessibilityLabel="Đóng" />
          <View className="bg-bg-surface rounded-t-xl border-t border-border" style={{ maxHeight: '92%' }}>
            <View className="flex-row items-start justify-between gap-sm px-xl pt-xl pb-md">
              <View className="flex-1">
                <Text className="text-lg font-bevn-bold text-text-primary">{title}</Text>
                {caption ? <Text className="text-sm text-text-secondary font-bevn-regular mt-0.5">{caption}</Text> : null}
              </View>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Đóng" disabled={!dismissible}>
                <Icon name="close" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md }}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View className="px-xl pt-md border-t border-border" style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}>
                {footer}
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAwareView>
    </Modal>
  );
}
