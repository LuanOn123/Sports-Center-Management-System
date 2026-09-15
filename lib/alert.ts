import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string, onOk?: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
  }
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'Xác nhận',
  destructive: boolean = false
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel', onPress: onCancel },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }
}
