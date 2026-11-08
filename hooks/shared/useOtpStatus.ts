// hooks/shared/useOtpStatus.ts
// Trạng thái mã OTP quên mật khẩu theo thời gian thực (đếm ngược gửi lại + hiệu lực) — quy tắc thuần ở lib/passwordReset

import { useEffect, useState } from 'react';
import { otpStatus } from '../../lib/passwordReset';

/** `sentAt`: mốc gửi mã gần nhất cho email đang dùng (null = chưa gửi). Chỉ chạy đồng hồ khi còn đếm ngược. */
export function useOtpStatus(sentAt: number | null, failedAttempts: number) {
  const [now, setNow] = useState(() => Date.now());
  const status = otpStatus({ sentAt, failedAttempts, now });
  const counting = status.resendWaitMs > 0 || status.validForMs > 0;

  useEffect(() => {
    if (sentAt === null) return;
    setNow(Date.now());
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAt, counting]);

  return status;
}
