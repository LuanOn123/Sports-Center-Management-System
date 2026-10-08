// components/member/payment/BankAppPickerModal.tsx
// Chọn app ngân hàng để mở (VietQR deeplink). Nhắc lưu ảnh QR trước để quét từ ảnh trong app ngân hàng.

import React from 'react';
import { View, Text, Modal, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../shared/Icon';
import { Colors, Spacing } from '../../../constants/theme';
import type { BankApp } from '../../../services/vietqrService';

const LOGO_SIZE = 40;

interface BankAppPickerModalProps {
  visible: boolean;
  apps: BankApp[];
  isLoading: boolean;
  isSavingQr: boolean;
  onSaveQr: () => void;
  onSelect: (app: BankApp) => void;
  onClose: () => void;
}

export function BankAppPickerModal({ visible, apps, isLoading, isSavingQr, onSaveQr, onSelect, onClose }: BankAppPickerModalProps) {
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
            <Text className="text-lg font-bevn-bold text-text-primary">Chọn app ngân hàng</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gợi ý: lưu QR trước rồi "Quét QR từ ảnh" trong app ngân hàng để điền đúng số tiền + nội dung */}
          <View className="mx-xl mb-md rounded-md p-md border" style={{ backgroundColor: Colors.status.scheduled + '15', borderColor: Colors.status.scheduled + '40' }}>
            <Text className="text-sm text-text-secondary font-bevn-regular mb-sm">
              Để không nhập sai, hãy lưu mã QR rồi trong app ngân hàng chọn <Text className="font-bevn-bold text-text-primary">Quét QR → Chọn ảnh</Text>.
            </Text>
            <TouchableOpacity className="flex-row items-center gap-1.5 self-start bg-bg-elevated rounded-md px-md py-xs" onPress={onSaveQr} disabled={isSavingQr}>
              {isSavingQr ? <ActivityIndicator size="small" color={Colors.text.secondary} /> : <Icon name="download" size={15} color={Colors.text.secondary} />}
              <Text className="text-sm text-text-secondary font-bevn-semibold">Lưu mã QR</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xxl }} />
          ) : (
            <FlatList
              data={apps}
              keyExtractor={(a) => a.appId}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center gap-md bg-bg-elevated rounded-lg p-md border border-border"
                  onPress={() => onSelect(item)}
                >
                  <Image source={{ uri: item.appLogo }} style={{ width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: 10 }} />
                  <View className="flex-1">
                    <Text className="text-sm font-bevn-semibold text-text-primary" numberOfLines={1}>{item.appName.trim()}</Text>
                    <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>{item.bankName}</Text>
                  </View>
                  {item.autofill === 1 && (
                    <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: Colors.primary + '20' }}>
                      <Text className="text-xs text-primary font-bevn-semibold">Tự điền</Text>
                    </View>
                  )}
                  <Icon name="chevron-right" size={18} color={Colors.text.muted} />
                </TouchableOpacity>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
