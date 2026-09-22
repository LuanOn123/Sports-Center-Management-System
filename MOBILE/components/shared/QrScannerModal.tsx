// components/shared/QrScannerModal.tsx
// Quét mã QR bằng camera hoặc nhập mã thủ công — dùng cho điểm danh

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon as MaterialIcons } from './Icon';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitCode: (code: string) => void;
  isSubmitting?: boolean;
}

export function QrScannerModal({ visible, onClose, onSubmitCode, isSubmitting }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');

  const handleClose = () => {
    setManualCode('');
    onClose();
  };

  // isSubmitting chặn quét trùng khi request đang chạy; quét lại được ngay sau khi lỗi
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isSubmitting) return;
    onSubmitCode(data);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    onSubmitCode(code);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Điểm danh bằng QR</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraBox}>
          {!permission ? (
            <ActivityIndicator color={Colors.primary} />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <MaterialIcons name="camera-alt" size={40} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.permissionText}>Cần quyền camera để quét mã QR</Text>
              <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                <Text style={styles.permissionBtnText}>Cấp quyền camera</Text>
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
            <View style={styles.scanningOverlay}>
              <ActivityIndicator color={Colors.text.inverse} size="large" />
            </View>
          )}
        </View>

        <Text style={styles.orText}>hoặc nhập mã thủ công</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.input}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Dán mã QR ở đây"
            placeholderTextColor={Colors.text.muted}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.submitBtn, (!manualCode.trim() || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleManualSubmit}
            disabled={!manualCode.trim() || isSubmitting}
          >
            <Text style={styles.submitBtnText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary, paddingTop: 56, paddingHorizontal: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  cameraBox: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bg.elevated, marginBottom: Spacing.lg },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  permissionText: { fontSize: FontSize.sm, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.lg, fontFamily: 'BeVietnamPro_400Regular' },
  permissionBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  permissionBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_700Bold' },
  scanningOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000060', alignItems: 'center', justifyContent: 'center' },
  orText: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.text.muted, marginBottom: Spacing.sm, fontFamily: 'BeVietnamPro_400Regular' },
  manualRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  input: {
    flex: 1, backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, color: Colors.text.primary, fontFamily: 'BeVietnamPro_400Regular',
    fontSize: FontSize.sm, borderWidth: 1, borderColor: Colors.border,
  },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: Colors.bg.elevated },
  submitBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_700Bold' },
});
