// components/shared/QrScannerModal.tsx
// Điểm danh: mở ra bảng chọn "Quét mã QR" / "Nhập mã điểm danh" (cùng 1 Modal — iOS không mở được
// Modal thứ 2 khi Modal đầu chưa đóng xong). Chỉ xin quyền camera khi người dùng chọn quét QR.
// - Quét: camera tràn toàn màn hình, khung ngắm 4 góc, nút chuyển sang nhập mã.
// - Nhập mã: ô nhập căn giữa phần màn hình còn thấy phía trên bàn phím.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon } from './Icon';
import type { AttendanceCredential } from '../../services/attendanceService';
import { Colors, Spacing } from '../../constants/theme';
import { QR_SCAN_FRAME_HEIGHT_RATIO, QR_SCAN_FRAME_MAX } from '../../constants/attendance';
import { useKeyboard } from '../../hooks/shared/useKeyboard';
import { Haptic } from '../../lib/haptics';

// Mã dự phòng: đúng 6 ký tự A-HJ-NP-Z2-9 (không dùng 0/O/1/I) — khớp quy tắc BE.
// Khác với QR token (JWT dài) nên phải gửi đúng field, không thì BE luôn báo sai mã.
const MANUAL_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

type Method = 'scan' | 'manual';
type Mode = 'choose' | Method;

const CORNER = 28;
const CLOSE_ICON_SIZE = 24;
/** Lớp nền mờ để chữ đọc được trên hình camera */
const SCRIM = '#00000073';
const CORNER_WIDTH = 4;
const CORNERS = [
  { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
];

const METHODS: Record<Method, { icon: string; title: string; description: string }> = {
  scan: { icon: 'qr-code-scanner', title: 'Quét mã QR', description: 'Dùng camera quét mã HLV đang hiển thị' },
  manual: { icon: 'dialpad', title: 'Nhập mã điểm danh', description: 'Nhập mã 6 ký tự do HLV cung cấp' },
};

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitCredential: (credential: AttendanceCredential) => void;
  isSubmitting?: boolean;
}

export function QrScannerModal({ visible, onClose, onSubmitCredential, isSubmitting }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('choose');
  const [manualCode, setManualCode] = useState('');
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboard = useKeyboard();
  const [rootHeight, setRootHeight] = useState(0);
  // Phần bị bàn phím che (Android đã tự thu nhỏ cửa sổ thì phần này ≈ 0)
  const keyboardOverlap = keyboard.visible ? Math.max(0, rootHeight - keyboard.top) : 0;
  const frameSize = Math.min(width - Spacing.xl * 2, height * QR_SCAN_FRAME_HEIGHT_RATIO, QR_SCAN_FRAME_MAX);
  const canSubmit = Boolean(manualCode.trim()) && !isSubmitting;
  const cameraOn = mode === 'scan' && Boolean(permission?.granted);

  // Mỗi lần mở lại bắt đầu từ bảng chọn
  useEffect(() => {
    if (visible) {
      setMode('choose');
      setManualCode('');
    }
  }, [visible]);

  // Người dùng đã chọn quét → lúc này mới xin quyền camera, CHỈ 1 lần mỗi lần vào chế độ quét
  // (Android vẫn để canAskAgain = true sau khi bị từ chối → không chặn thì hộp thoại bật lại liên tục)
  const askedCamera = useRef(false);
  useEffect(() => {
    if (mode !== 'scan') {
      askedCamera.current = false;
      return;
    }
    if (askedCamera.current || !permission || permission.granted || !permission.canAskAgain) return;
    askedCamera.current = true;
    void requestPermission();
  }, [mode, permission, requestPermission]);

  const handleClose = () => {
    Haptic.light();
    onClose();
  };

  const choose = (method: Method) => {
    Haptic.selection();
    setMode(method);
  };

  // isSubmitting chặn quét trùng khi request đang chạy; quét lại được ngay sau khi lỗi.
  // Camera luôn trả về đúng nội dung QR (JWT) nên gửi thẳng dưới field qrToken.
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isSubmitting) return;
    Haptic.medium();
    onSubmitCredential({ qrToken: data });
  };

  // Ô nhập tay: nếu gõ đúng 6 ký tự mã dự phòng thì gửi qua field `code`, còn lại
  // (ví dụ dán nguyên chuỗi QR) coi là qrToken — cùng cách FE web đang xử lý.
  const handleManualSubmit = () => {
    const raw = manualCode.trim();
    if (!raw) return;
    Haptic.medium();
    const normalized = raw.toUpperCase().replace(/\s/g, '');
    if (MANUAL_CODE_RE.test(normalized)) {
      onSubmitCredential({ code: normalized });
    } else {
      onSubmitCredential({ qrToken: raw });
    }
  };

  const header = (title: string) => (
    <View
      className="flex-row items-center px-xl pb-md"
      style={{ paddingTop: insets.top + Spacing.md, backgroundColor: cameraOn ? SCRIM : undefined }}
    >
      {/* Khoảng trống bằng nút đóng để tiêu đề nằm đúng giữa màn hình */}
      <View style={{ width: CLOSE_ICON_SIZE }} />
      <Text className="flex-1 text-center text-lg font-bold font-bevn-bold text-text-primary">{title}</Text>
      <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Đóng">
        <Icon name="close" size={CLOSE_ICON_SIZE} color={Colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  // Nút chuyển sang cách điểm danh còn lại
  const switchTo = (method: Method) => (
    <TouchableOpacity
      className="flex-row items-center gap-1.5 self-center rounded-full px-lg py-sm"
      style={{ backgroundColor: cameraOn ? SCRIM : undefined }}
      onPress={() => choose(method)}
    >
      <Icon name={METHODS[method].icon} size={16} color={Colors.primary} />
      <Text className="text-sm text-primary font-bevn-semibold">{METHODS[method].title}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {mode === 'choose' ? (
        <TouchableOpacity className="flex-1 bg-overlay justify-end" activeOpacity={1} onPress={handleClose}>
          <TouchableOpacity
            activeOpacity={1}
            className="bg-bg-surface rounded-t-xl border-t border-border px-xl pt-xl"
            style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
          >
            <Text className="text-lg font-bevn-bold text-text-primary text-center mb-lg">Chọn cách điểm danh</Text>
            {(Object.keys(METHODS) as Method[]).map((method) => (
              <TouchableOpacity
                key={method}
                accessibilityRole="button"
                className="flex-row items-center gap-md bg-bg-elevated rounded-lg p-lg border border-border mb-sm"
                onPress={() => choose(method)}
              >
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: Colors.primary + '20' }}>
                  <Icon name={METHODS[method].icon} size={20} color={Colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-md font-bevn-semibold text-text-primary">{METHODS[method].title}</Text>
                  <Text className="text-xs font-bevn-regular text-text-secondary mt-0.5">{METHODS[method].description}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity className="items-center py-md" onPress={handleClose}>
              <Text className="text-md text-text-secondary font-bevn-semibold">Hủy</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : (
        <View className="flex-1 bg-bg-primary" onLayout={(e) => setRootHeight(e.nativeEvent.layout.height)}>
          {/* Camera làm nền toàn màn hình */}
          {cameraOn && (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}

          {header(METHODS[mode].title)}

          {mode === 'scan' ? (
            <View className="flex-1 px-xl" style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}>
              <View className="flex-1 items-center justify-center">
                {!permission ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : !permission.granted ? (
                  <View className="items-center p-xl">
                    <Icon name="camera-alt" size={40} color={Colors.text.muted} style={{ marginBottom: 12 }} />
                    <Text className="text-sm font-bevn-regular text-text-secondary text-center mb-lg">
                      {permission.canAskAgain
                        ? 'Cần quyền camera để quét mã QR'
                        : 'Quyền camera đang tắt. Hãy bật lại trong Cài đặt của máy, hoặc nhập mã điểm danh.'}
                    </Text>
                    {permission.canAskAgain && (
                      <TouchableOpacity className="bg-primary rounded-md py-sm px-lg" onPress={requestPermission}>
                        <Text className="text-text-inverse font-bold font-bevn-bold text-sm">Cấp quyền camera</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <>
                    <View style={{ width: frameSize, height: frameSize, pointerEvents: 'none' }}>
                      {CORNERS.map((corner, i) => (
                        <View key={i} style={{ position: 'absolute', width: CORNER, height: CORNER, borderColor: Colors.primary, ...corner }} />
                      ))}
                    </View>
                    <View className="rounded-full px-lg py-xs mt-lg" style={{ backgroundColor: SCRIM }}>
                      <Text className="text-sm font-bevn-medium text-text-primary text-center">Đưa mã QR do HLV hiển thị vào trong khung</Text>
                    </View>
                  </>
                )}
              </View>
              {switchTo('manual')}
            </View>
          ) : (
            <View
              className="flex-1 justify-center px-xl"
              style={{ paddingBottom: keyboard.visible ? keyboardOverlap + Spacing.lg : Math.max(insets.bottom, Spacing.lg) }}
            >
              <View className="bg-bg-surface rounded-xl p-lg border border-border mb-lg">
                <Text className="text-sm font-bevn-regular text-text-secondary mb-sm">{METHODS.manual.description}</Text>
                <View className="flex-row gap-sm">
                  <TextInput
                    className="flex-1 bg-bg-elevated rounded-md px-md py-sm text-text-primary font-bevn-semibold text-md border border-border"
                    style={{ letterSpacing: 2 }}
                    value={manualCode}
                    onChangeText={setManualCode}
                    placeholder="VD: K7M2QP"
                    placeholderTextColor={Colors.text.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="send"
                    onSubmitEditing={() => canSubmit && handleManualSubmit()}
                    maxLength={64}
                  />
                  <TouchableOpacity
                    className={clsx('rounded-md px-lg justify-center', canSubmit ? 'bg-primary' : 'bg-bg-elevated')}
                    onPress={handleManualSubmit}
                    disabled={!canSubmit}
                  >
                    <Text className={clsx('font-bold font-bevn-bold text-sm', canSubmit ? 'text-text-inverse' : 'text-text-muted')}>Gửi</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {switchTo('scan')}
            </View>
          )}

          {isSubmitting && (
            <View className="absolute inset-0 bg-[#00000060] items-center justify-center">
              <ActivityIndicator color={Colors.text.inverse} size="large" />
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}
