// components/shared/AlertModal.tsx
// Modal thông báo và xác nhận toàn cục dùng chung

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import clsx from 'clsx';
import { MaterialIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { Colors, Spacing, Radius, Shadow } from '../../constants/theme';
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
        <View className="flex-1 justify-center items-center p-xl">
          {/* NativeWind chưa xử lý được className trên Animated.View ở web (RN Native
              Wind chỉ patch View/Text thường) — dùng style inline trực tiếp cho 2 View
              động này, còn các View/Text con bên trong vẫn dùng className bình thường. */}
          <Animated.View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              opacity: opacityAnim,
            }}
          />
          <TouchableWithoutFeedback>
            <Animated.View
              style={{
                width: '100%',
                maxWidth: 340,
                backgroundColor: Colors.bg.surface,
                borderRadius: Radius.xl,
                padding: Spacing.xl,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
                ...Shadow.md,
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              }}
            >
              {/* Icon */}
              <View className="w-14 h-14 rounded-full justify-center items-center mb-md" style={{ backgroundColor: iconBg }}>
                <Icon name={iconName} size={28} color={iconColor} />
              </View>

              {/* Title & Message */}
              <Text className="text-lg font-bold font-bevn-bold text-text-primary text-center mb-xs">{options.title}</Text>
              {Boolean(options.message) && (
                <Text className="text-sm font-bevn-regular text-text-secondary text-center leading-5 mb-lg">{options.message}</Text>
              )}

              {/* Actions */}
              <View className="flex-row gap-md w-full mt-xs">
                {isConfirmDialog ? (
                  <>
                    <TouchableOpacity
                      className="flex-1 py-3 px-lg rounded-md items-center justify-center bg-bg-elevated border border-border"
                      onPress={handleCancel}
                      activeOpacity={0.8}
                    >
                      <Text className="text-sm font-semibold font-bevn-semibold text-text-secondary">{options.cancelText || 'Hủy'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={clsx(
                        'flex-1 py-3 px-lg rounded-md items-center justify-center',
                        isDestructive ? 'bg-status-failed' : 'bg-primary'
                      )}
                      onPress={handleConfirm}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={clsx(
                          'text-sm font-bold font-bevn-bold',
                          isDestructive ? 'text-white' : 'text-text-inverse'
                        )}
                      >
                        {options.confirmText || 'Đồng ý'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    className="flex-1 py-3 px-lg rounded-md items-center justify-center bg-primary"
                    onPress={handleConfirm}
                    activeOpacity={0.8}
                  >
                    <Text className="text-sm font-bold font-bevn-bold text-text-inverse">{options.confirmText || 'Đã hiểu'}</Text>
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
