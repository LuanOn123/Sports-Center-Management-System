// hooks/coach/useQrAttendance.ts
// Tạo mã QR điểm danh cho 1 ca học — tự đổi mã trước khi hết hạn, dừng khi đóng modal

import { useCallback, useEffect, useState } from 'react';
import { generateAttendanceQr } from '../../services/coachService';
import { ApiError } from '../../lib/api';

const REFRESH_MS = 55_000; // BE cấp token sống 60s, đổi mã sớm hơn 1 chút cho an toàn

export function useQrAttendance(scheduleId: string | undefined) {
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!scheduleId) return;
    try {
      setError(null);
      const res = await generateAttendanceQr(scheduleId);
      setToken(res.data.qrToken);
      setExpiresAt(Date.now() + res.data.expiresIn * 1000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tạo được mã QR. Vui lòng thử lại.');
    }
  }, [scheduleId]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => {
    setVisible(false);
    setToken(null);
    setExpiresAt(null);
  }, []);

  // Tạo mã lần đầu + tự đổi mã định kỳ khi modal đang mở
  useEffect(() => {
    if (!visible) return;
    generate();
    const id = setInterval(generate, REFRESH_MS);
    return () => clearInterval(id);
  }, [visible, generate]);

  // Đếm ngược hiển thị — chỉ để UI, không tự gọi lại API
  useEffect(() => {
    if (!visible || !expiresAt) return;
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, expiresAt]);

  return { visible, token, secondsLeft, error, open, close };
}
