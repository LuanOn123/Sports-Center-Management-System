// hooks/coach/useQrAttendance.ts
// Tạo mã QR điểm danh + mã dự phòng cho 1 ca học — tự đổi mã định kỳ, dừng khi đóng modal

import { useCallback, useEffect, useState } from 'react';
import { generateAttendanceQr } from '../../services/coachService';
import { ApiError } from '../../lib/api';

// BE tự tài liệu: "FE tự làm mới mã mỗi 55 giây" — QR JWT sống 600s nhưng mã dự
// phòng chỉ sống 90s, nên phải đổi mã đều đặn để mã dự phòng luôn còn hiệu lực.
const REFRESH_MS = 55_000;

export function useQrAttendance(scheduleId: string | undefined) {
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [manualCodeExpiresAt, setManualCodeExpiresAt] = useState<number | null>(null);
  const [manualCodeSecondsLeft, setManualCodeSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!scheduleId) return;
    try {
      setError(null);
      const res = await generateAttendanceQr(scheduleId);
      setToken(res.data.qrToken);
      setManualCode(res.data.manualCode);
      setManualCodeExpiresAt(Date.now() + res.data.manualCodeExpiresIn * 1000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tạo được mã QR. Vui lòng thử lại.');
    }
  }, [scheduleId]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => {
    setVisible(false);
    setToken(null);
    setManualCode(null);
    setManualCodeExpiresAt(null);
  }, []);

  // Tạo mã lần đầu + tự đổi mã định kỳ khi modal đang mở
  useEffect(() => {
    if (!visible) return;
    generate();
    const id = setInterval(generate, REFRESH_MS);
    return () => clearInterval(id);
  }, [visible, generate]);

  // Đếm ngược mã dự phòng — chỉ để UI, không tự gọi lại API
  useEffect(() => {
    if (!visible || !manualCodeExpiresAt) return;
    const id = setInterval(() => {
      setManualCodeSecondsLeft(Math.max(0, Math.ceil((manualCodeExpiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, manualCodeExpiresAt]);

  return { visible, token, manualCode, manualCodeSecondsLeft, error, open, close };
}
