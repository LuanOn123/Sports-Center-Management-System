// lib/alert.ts
// Custom mobile alert and confirm dialog dispatcher

export type AlertType = 'alert' | 'confirm';

export interface AlertOptions {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type AlertListener = (options: AlertOptions | null) => void;
let alertListener: AlertListener | null = null;

export function registerAlertListener(listener: AlertListener) {
  alertListener = listener;
  return () => {
    alertListener = null;
  };
}

export function showAlert(title: string, message?: string, onOk?: () => void) {
  if (alertListener) {
    alertListener({
      id: String(Date.now()),
      type: 'alert',
      title,
      message,
      confirmText: 'Đồng ý',
      onConfirm: () => {
        if (onOk) onOk();
      },
    });
  } else {
    // Fallback if dialog is not mounted
    if (onOk) onOk();
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
  if (alertListener) {
    alertListener({
      id: String(Date.now()),
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText: 'Hủy',
      destructive,
      onConfirm,
      onCancel,
    });
  } else {
    if (onCancel) onCancel();
  }
}
