// hooks/coach/useQrAttendance.ts
// Mã QR điểm danh + mã dự phòng của một buổi (web: shared/QrAttendance.tsx): tạo khi mở, tự đổi mã định kỳ, đếm ngược hạn từng mã,
// làm mới bằng tay, sao chép mã dự phòng; dừng hẳn khi đóng. Cách tính hạn ở lib/qrAttendance.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { generateAttendanceQr } from '../../services/attendanceService';
import { ApiError } from '../../lib/api';
import { qrCountdown, toQrCredential, type QrCredential } from '../../lib/qrAttendance';
import { QR_COPIED_MS, QR_REFRESH_MS, QR_TEXT } from '../../constants/attendance';

export function useQrAttendance(scheduleId: string | undefined) {
  const [visible, setVisible] = useState(false);
  const [credential, setCredential] = useState<QrCredential | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Tăng mỗi lần "Làm mới QR": chu kỳ tự đổi mã 55 giây bắt đầu lại từ mã vừa tạo, không đổi mã thêm ngay sau đó */
  const [cycle, setCycle] = useState(0);
  /** Mỗi lần tạo / đóng tăng một số: phản hồi của lần cũ (đã bị thay bằng mã mới hoặc modal đã đóng) bị bỏ qua */
  const latestRequest = useRef(0);

  const generate = useCallback(async () => {
    if (!scheduleId) return;
    const request = ++latestRequest.current;
    const startedAt = Date.now();
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAttendanceQr(scheduleId);
      if (request === latestRequest.current) setCredential(toQrCredential(result.data, startedAt));
    } catch (e) {
      if (request === latestRequest.current) setError(e instanceof ApiError ? e.message : QR_TEXT.failed);
    } finally {
      if (request === latestRequest.current) setGenerating(false);
    }
  }, [scheduleId]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => {
    latestRequest.current += 1;
    setVisible(false);
    setCredential(null);
    setError(null);
    setGenerating(false);
    setCopied(false);
  }, []);

  // Tạo mã khi mở (và mỗi lần làm mới tay) rồi đổi mã định kỳ (mã dự phòng chỉ sống 90 giây); đồng hồ 1 giây để đếm ngược hạn
  useEffect(() => {
    if (!visible) return;
    void generate();
    setNow(Date.now());
    const refresh = setInterval(() => { void generate(); }, QR_REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [visible, generate, cycle]);

  // "Đã sao chép" chỉ hiện một lúc
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), QR_COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyManualCode = useCallback(async () => {
    if (!credential?.manualCode) return;
    try {
      await Clipboard.setStringAsync(credential.manualCode);
      setCopied(true);
    } catch {
      setCopied(false); // máy không cho ghi clipboard: mã vẫn đọc được trên màn hình
    }
  }, [credential]);

  return {
    visible,
    open,
    close,
    token: credential?.token ?? null,
    manualCode: credential?.manualCode ?? null,
    ...qrCountdown(credential, now),
    /** Đang tạo mã (lần đầu, tự đổi hoặc làm mới tay) */
    generating,
    error,
    /** "Làm mới QR": tạo mã mới ngay (thu hồi mã dự phòng cũ) và tính lại chu kỳ tự đổi mã */
    refresh: () => setCycle((n) => n + 1),
    copied,
    copyManualCode,
  };
}
