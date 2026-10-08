// components/coach/AttendanceQrModal.tsx
// Modal mã QR điểm danh + mã dự phòng (logic ở hooks/coach/useQrAttendance)

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '../../constants/theme';
import type { useQrAttendance } from '../../hooks/coach/useQrAttendance';

const QR_SIZE = 200;

export function AttendanceQrModal({ qr }: { qr: ReturnType<typeof useQrAttendance> }) {
  return (
    <Modal visible={qr.visible} transparent animationType="fade" onRequestClose={qr.close}>
      <TouchableOpacity className="flex-1 bg-overlay justify-center items-center p-xl" activeOpacity={1} onPress={qr.close}>
        <TouchableOpacity activeOpacity={1} className="bg-bg-surface rounded-xl p-xl w-full max-w-[320px] border border-border items-center">
          <Text className="text-md font-bevn-bold text-text-primary mb-lg">Mã QR điểm danh</Text>
          <Text className="text-xs text-text-muted text-center mb-lg font-bevn-regular">Hội viên quét mã này để điểm danh vào lớp</Text>
          <View className="items-center justify-center mb-md" style={{ width: QR_SIZE, height: QR_SIZE }}>
            {qr.token ? <QRCode value={qr.token} size={QR_SIZE} /> : <ActivityIndicator color={Colors.primary} size="large" />}
          </View>
          {Boolean(qr.error) && <Text className="text-sm text-status-expired text-center mb-md font-bevn-regular">{qr.error}</Text>}
          {Boolean(qr.manualCode) && (
            <View className="w-full items-center bg-bg-elevated rounded-lg p-lg mb-lg border border-border">
              <Text className="text-xs text-text-muted font-bevn-semibold tracking-wide">MÃ DỰ PHÒNG (không quét được QR)</Text>
              <Text className="text-xxl font-bevn-bold text-primary tracking-[6px] mt-1">{qr.manualCode}</Text>
              <Text className="text-xs text-text-secondary mt-1 font-bevn-medium">Hết hạn sau {qr.manualCodeSecondsLeft}s</Text>
            </View>
          )}
          <TouchableOpacity className="py-sm px-xl rounded-md bg-bg-elevated" onPress={qr.close}>
            <Text className="text-text-secondary text-sm font-bevn-medium">Đóng</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
