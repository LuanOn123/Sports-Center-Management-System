// components/coach/AttendanceQrModal.tsx
// Modal mã QR điểm danh + mã dự phòng (web: shared/QrAttendance.tsx › AttendanceQr): mã QR kèm đếm ngược, mã dự phòng kèm
// đếm ngược và nút sao chép, "Làm mới QR", báo hết hạn. Logic ở hooks/coach/useQrAttendance.

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Icon } from '../shared/Icon';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/theme';
import { QR_CODE_QUIET_ZONE, QR_CODE_SIZE, QR_TEXT as TEXT } from '../../constants/attendance';
import { formatCountdown } from '../../lib/format';
import type { useQrAttendance } from '../../hooks/coach/useQrAttendance';

export function AttendanceQrModal({ qr }: { qr: ReturnType<typeof useQrAttendance> }) {
  const showQr = Boolean(qr.token) && !qr.qrExpired;

  return (
    <Modal visible={qr.visible} transparent animationType="fade" onRequestClose={qr.close}>
      <TouchableOpacity className="flex-1 bg-overlay justify-center items-center p-xl" activeOpacity={1} onPress={qr.close}>
        <TouchableOpacity activeOpacity={1} className="bg-bg-surface rounded-xl p-xl w-full max-w-[340px] border border-border items-center">
          <Text className="text-md font-bevn-bold text-text-primary mb-xs">{TEXT.title}</Text>
          <Text className="text-xs text-text-muted text-center mb-lg font-bevn-regular">{TEXT.intro}</Text>

          <View className="items-center justify-center mb-xs" style={{ width: QR_CODE_SIZE, height: QR_CODE_SIZE }}>
            {showQr ? (
              <QRCode
                value={qr.token!}
                size={QR_CODE_SIZE}
                quietZone={QR_CODE_QUIET_ZONE}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            ) : qr.qrExpired ? (
              <Text accessibilityRole="alert" className="text-sm text-status-expired text-center font-bevn-medium">{TEXT.expired}</Text>
            ) : (
              <ActivityIndicator color={Colors.primary} size="large" />
            )}
          </View>
          {showQr && (
            <Text className="text-xs text-text-secondary mb-md font-bevn-medium">{TEXT.validFor(formatCountdown(qr.qrSeconds * 1000))}</Text>
          )}

          {Boolean(qr.error) && <Text accessibilityRole="alert" className="text-sm text-status-expired text-center mb-md font-bevn-regular">{qr.error}</Text>}

          {Boolean(qr.manualCode) && (
            <View className="w-full items-center bg-bg-elevated rounded-lg p-lg mb-md border border-border">
              <Text className="text-xs text-text-muted font-bevn-semibold tracking-wide text-center">{TEXT.manualTitle}</Text>
              <Text selectable className="text-xxl font-bevn-bold text-primary tracking-[6px] mt-1">{qr.manualCode}</Text>
              <Text className="text-xs text-text-secondary mt-1 font-bevn-medium">
                {qr.manualExpired ? TEXT.manualExpired : TEXT.manualExpiresIn(qr.manualSeconds)}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={TEXT.copy}
                className="flex-row items-center gap-1 mt-sm px-md py-xs rounded-md border border-border bg-bg-surface"
                onPress={() => { void qr.copyManualCode(); }}
              >
                <Icon name={qr.copied ? 'check-circle' : 'content-copy'} size={14} color={qr.copied ? Colors.status.success : Colors.text.secondary} />
                <Text className="text-xs font-bevn-semibold text-text-secondary">{qr.copied ? TEXT.copied : TEXT.copy}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="flex-row gap-md w-full">
            <Button className="flex-1" size="sm" variant="secondary" icon="refresh" title={qr.generating ? TEXT.refreshing : TEXT.refresh} disabled={qr.generating} onPress={qr.refresh} />
            <Button className="flex-1" size="sm" variant="outline" title={TEXT.close} onPress={qr.close} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
