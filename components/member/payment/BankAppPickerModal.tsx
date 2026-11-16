// components/member/payment/BankAppPickerModal.tsx
// Chọn app ngân hàng để mở (VietQR deeplink). App có nhãn "Tự điền" mở sẵn số tiền + nội dung; với app khác, chọn là app tự lưu mã QR
// và sao chép nội dung chuyển khoản rồi mới mở (hooks/member/usePayment › prepareBankApp) — người dùng chỉ việc Quét QR → Chọn ảnh.

import React from 'react';
import { View, Text, Modal, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../shared/Icon';
import { Colors, Spacing } from '../../../constants/theme';
import { BANK_APP_TEXT as TEXT } from '../../../constants/payment';
import type { BankApp } from '../../../services/vietqrService';

const LOGO_SIZE = 40;

interface BankAppPickerModalProps {
  visible: boolean;
  apps: BankApp[];
  isLoading: boolean;
  /** Đang lưu mã QR / sao chép nội dung cho app vừa chọn — khóa danh sách để không bấm hai lần */
  isPreparing: boolean;
  /** App mở ra là có sẵn số tiền + nội dung (nhãn "Tự điền") */
  isAutofill: (app: BankApp) => boolean;
  onSelect: (app: BankApp) => void;
  onClose: () => void;
}

export function BankAppPickerModal({ visible, apps, isLoading, isPreparing, isAutofill, onSelect, onClose }: BankAppPickerModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-overlay justify-end" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          className="bg-bg-surface rounded-t-xl border-t border-border max-h-[80%]"
          style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
        >
          <View className="flex-row items-center justify-between px-xl pt-xl pb-md">
            <Text className="text-lg font-bevn-bold text-text-primary">{TEXT.pickerTitle}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Hai cách đến app ngân hàng: tự điền (chỉ cần đăng nhập + xác nhận) hoặc quét ảnh QR đã lưu */}
          <View className="mx-xl mb-md rounded-md p-md border gap-xs" style={{ backgroundColor: Colors.status.scheduled + '15', borderColor: Colors.status.scheduled + '40' }}>
            <Text className="text-sm text-text-secondary font-bevn-regular">{TEXT.pickerHintAutofill}</Text>
            <Text className="text-sm text-text-secondary font-bevn-regular">{TEXT.pickerHintScan}</Text>
          </View>

          {isPreparing && (
            <View className="flex-row items-center gap-sm px-xl pb-md">
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.preparing}</Text>
            </View>
          )}

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xxl }} />
          ) : (
            <FlatList
              data={apps}
              keyExtractor={(a) => a.appId}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}
              renderItem={({ item }) => {
                const autofill = isAutofill(item);
                return (
                  <TouchableOpacity
                    className="flex-row items-center gap-md bg-bg-elevated rounded-lg p-md border border-border"
                    style={{ opacity: isPreparing ? 0.5 : 1 }}
                    disabled={isPreparing}
                    onPress={() => onSelect(item)}
                  >
                    <Image source={{ uri: item.appLogo }} style={{ width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: 10 }} />
                    <View className="flex-1">
                      <Text className="text-sm font-bevn-semibold text-text-primary" numberOfLines={1}>{item.appName.trim()}</Text>
                      <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>{item.bankName}</Text>
                    </View>
                    <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: autofill ? Colors.primary + '20' : Colors.bg.surface }}>
                      <Text className="text-xs font-bevn-semibold" style={{ color: autofill ? Colors.primary : Colors.text.muted }}>
                        {autofill ? TEXT.badgeAutofill : TEXT.badgeScan}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={Colors.text.muted} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
