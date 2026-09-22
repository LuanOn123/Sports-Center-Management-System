// components/shared/AlertModal.tsx
// Modal thông báo và xác nhận toàn cục dùng chung

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { registerAlertListener, type AlertOptions } from '../../lib/alert';

export function AlertModal() {
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return registerAlertListener((opts) => {
      setOptions(opts);
      if (opts) {
        scaleAnim.setValue(0.9);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
            tension: 60,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  }, [scaleAnim, opacityAnim]);

  if (!options) return null;

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setOptions(null);
    });
  };

  const handleConfirm = () => {
    const cb = options.onConfirm;
    handleClose();
    if (cb) {
      setTimeout(() => cb(), 150);
    }
  };

  const handleCancel = () => {
    const cb = options.onCancel;
    handleClose();
    if (cb) {
      setTimeout(() => cb(), 150);
    }
  };

  // Determine icon & theme based on title and options
  const isError =
    options.title.toLowerCase().includes('lỗi') ||
    options.title.toLowerCase().includes('thất bại') ||
    options.title.toLowerCase().includes('hết chỗ');
  const isSuccess =
    options.title.toLowerCase().includes('thành công') ||
    options.title.toLowerCase().includes('đã đặt') ||
    options.title.toLowerCase().includes('đã hủy') ||
    options.title.toLowerCase().includes('đã hoàn thành');
  const isDestructive = Boolean(options.destructive);

  let iconName: keyof typeof MaterialIcons.glyphMap = 'info-outline';
  let iconColor: string = Colors.primary;
  let iconBg: string = Colors.primary + '20';

  if (isError || isDestructive) {
    iconName = isDestructive ? 'delete-outline' : 'error-outline';
    iconColor = Colors.status.failed;
    iconBg = Colors.status.failed + '20';
  } else if (isSuccess) {
    iconName = 'check-circle-outline';
    iconColor = Colors.status.success;
    iconBg = Colors.status.success + '20';
  }

  const isConfirmDialog = options.type === 'confirm';

  return (
    <Modal
      transparent
      visible={Boolean(options)}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={isConfirmDialog ? undefined : handleClose}>
        <View style={styles.backdrop}>
          <Animated.View style={[styles.backdropFill, { opacity: opacityAnim }]} />
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Icon */}
              <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                <Icon name={iconName} size={28} color={iconColor} />
              </View>

              {/* Title & Message */}
              <Text style={styles.title}>{options.title}</Text>
              {Boolean(options.message) && <Text style={styles.message}>{options.message}</Text>}

              {/* Actions */}
              <View style={styles.btnRow}>
                {isConfirmDialog ? (
                  <>
                    <TouchableOpacity
                      style={[styles.btn, styles.cancelBtn]}
                      onPress={handleCancel}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelBtnText}>{options.cancelText || 'Hủy'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        isDestructive ? styles.destructiveBtn : styles.confirmBtn,
                      ]}
                      onPress={handleConfirm}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.confirmBtnText,
                          isDestructive && styles.destructiveBtnText,
                        ]}
                      >
                        {options.confirmText || 'Đồng ý'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.btn, styles.confirmBtn, { flex: 1 }]}
                    onPress={handleConfirm}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnText}>{options.confirmText || 'Đã hiểu'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  backdropFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    fontFamily: 'BeVietnamPro_700Bold',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginTop: Spacing.xs,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  confirmBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.inverse,
    fontFamily: 'BeVietnamPro_700Bold',
  },
  destructiveBtn: {
    flex: 1,
    backgroundColor: Colors.status.failed,
  },
  destructiveBtnText: {
    color: '#ffffff',
  },
});
