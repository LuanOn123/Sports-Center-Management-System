// components/shared/QrScannerModal.tsx
// Quét mã QR bằng camera hoặc nhập mã thủ công — dùng cho điểm danh

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon } from './Icon';
import type { AttendanceCredential } from '../../services/memberService';
import { Colors } from '../../constants/theme';

// Mã dự phòng: đúng 6 ký tự A-HJ-NP-Z2-9 (không dùng 0/O/1/I) — khớp quy tắc BE.
// Khác với QR token (JWT dài) nên phải gửi đúng field, không thì BE luôn báo sai mã.
const MANUAL_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitCredential: (credential: AttendanceCredential) => void;
  isSubmitting?: boolean;
}

export function QrScannerModal({ visible, onClose, onSubmitCredential, isSubmitting }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');

  const handleClose = () => {
    setManualCode('');
    onClose();
  };

  // isSubmitting chặn quét trùng khi request đang chạy; quét lại được ngay sau khi lỗi.
  // Camera luôn trả về đúng nội dung QR (JWT) nên gửi thẳng dưới field qrToken.
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isSubmitting) return;
    onSubmitCredential({ qrToken: data });
  };

  // Ô nhập tay: nếu gõ đúng 6 ký tự mã dự phòng thì gửi qua field `code`, còn lại
  // (ví dụ dán nguyên chuỗi QR) coi là qrToken — cùng cách FE web đang xử lý.
  const handleManualSubmit = () => {
    const raw = manualCode.trim();
    if (!raw) return;
    const normalized = raw.toUpperCase().replace(/\s/g, '');
    if (MANUAL_CODE_RE.test(normalized)) {
      onSubmitCredential({ code: normalized });
    } else {
      onSubmitCredential({ qrToken: raw });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-bg-primary pt-[56px] px-xl">
        <View className="flex-row justify-between items-center mb-lg">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Điểm danh bằng QR</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View className="flex-1 rounded-lg overflow-hidden bg-bg-elevated mb-lg">
          {!permission ? (
            <ActivityIndicator color={Colors.primary} />
          ) : !permission.granted ? (
            <View className="flex-1 items-center justify-center p-xl">
              <Icon name="camera-alt" size={40} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-sm font-bevn-regular text-text-secondary text-center mb-lg">Cần quyền camera để quét mã QR</Text>
              <TouchableOpacity className="bg-primary rounded-md py-sm px-lg" onPress={requestPermission}>
                <Text className="text-text-inverse font-bold font-bevn-bold text-sm">Cấp quyền camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          {isSubmitting && (
            <View className="absolute inset-0 bg-[#00000060] items-center justify-center">
              <ActivityIndicator color={Colors.text.inverse} size="large" />
            </View>
          )}
        </View>

        <Text className="text-center text-xs font-bevn-regular text-text-muted mb-sm">hoặc nhập mã dự phòng do HLV cung cấp (không quét được QR)</Text>
        <View className="flex-row gap-sm mb-xl">
          <TextInput
            className="flex-1 bg-bg-elevated rounded-md px-md py-sm text-text-primary font-bevn-regular text-sm border border-border"
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Ví dụ: K7M2QP"
            placeholderTextColor={Colors.text.muted}
            autoCapitalize="characters"
            maxLength={64}
          />
          <TouchableOpacity
            className={clsx(
              'rounded-md px-lg justify-center',
              (!manualCode.trim() || isSubmitting) ? 'bg-bg-elevated' : 'bg-primary'
            )}
            onPress={handleManualSubmit}
            disabled={!manualCode.trim() || isSubmitting}
          >
            <Text className="text-text-inverse font-bold font-bevn-bold text-sm">Gửi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
