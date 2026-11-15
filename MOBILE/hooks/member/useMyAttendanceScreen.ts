// hooks/member/useMyAttendanceScreen.ts
// Màn "Chuyên cần & Điểm danh" của hội viên: tỉ lệ theo lớp, quyết định chuyên cần (kèm khiếu nại), lịch sử, quét QR (web: AttendancePage)

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppealPenalty, useMyAttendance, useMyAttendanceSummary, useScanAttendance } from './useAttendance';
import { APPEAL_REASON_MIN, MY_ATTENDANCE_TEXT as TEXT } from '../../constants/attendance';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import type { AttendanceCredential } from '../../services/attendanceService';

export function useMyAttendanceScreen() {
  const history = useMyAttendance();
  const summary = useMyAttendanceSummary();
  const appealMutation = useAppealPenalty();
  const scan = useScanAttendance();
  const [appealingId, setAppealingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Mỗi lần màn được mở lại thì tải mới (điểm danh vừa ghi nhận phải hiện ngay)
  const refetchSummary = summary.refetch;
  const refetchHistory = history.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchSummary();
      void refetchHistory();
    }, [refetchSummary, refetchHistory]),
  );

  const refresh = async () => {
    Haptic.light();
    await Promise.all([summary.refetch(), history.refetch()]);
  };

  const reasonValid = reason.trim().length >= APPEAL_REASON_MIN;

  return {
    history,
    summary,
    buckets: summary.data?.data?.buckets ?? [],
    penalties: summary.data?.data?.penalties ?? [],
    records: history.data?.data ?? [],
    refresh,
    appeal: {
      /** Quyết định đang mở ô nhập lý do khiếu nại */
      openId: appealingId,
      reason,
      setReason,
      canSubmit: reasonValid && !appealMutation.isPending,
      isPending: appealMutation.isPending,
      start: (id: string) => {
        Haptic.light();
        setAppealingId(id);
        setReason('');
      },
      cancel: () => setAppealingId(null),
      submit: (id: string) => {
        if (!reasonValid) return;
        Haptic.medium();
        appealMutation.mutate(
          { id, reason: reason.trim() },
          {
            onSuccess: () => {
              Haptic.success();
              setAppealingId(null);
              setReason('');
            },
            onError: () => Haptic.error(),
          },
        );
      },
    },
    scanner: {
      open: scannerOpen,
      show: () => setScannerOpen(true),
      close: () => setScannerOpen(false),
      isSubmitting: scan.isPending,
      submit: (credential: AttendanceCredential) =>
        scan.mutate(credential, {
          onSuccess: () => {
            setScannerOpen(false);
            showAlert(TEXT.scanOk.title, TEXT.scanOk.message);
          },
          onError: (e) => showAlert(TEXT.scanFail, e.message),
        }),
    },
  };
}
