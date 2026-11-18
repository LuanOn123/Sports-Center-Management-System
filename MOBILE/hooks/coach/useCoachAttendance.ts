// hooks/coach/useCoachAttendance.ts
// Logic màn Điểm danh MỘT buổi của HLV (danh sách học viên) — theo FE web (FE/src/shared/Attendance.tsx):
// chỉ ghi khi đang trong cửa sổ điểm danh, bản ghi đã có thì chỉ xem (quản lý mới sửa),
// HLV không chọn "Vắng có phép". Danh sách buổi để chọn: hooks/coach/useCoachAttendanceList.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSaveEvaluation, useScheduleEvaluations } from './useScheduleEvaluations';
import { getScheduleEnrollments } from '../../services/coachService';
import { createAttendance, getScheduleAttendance } from '../../services/attendanceService';
import { getScheduleById } from '../../services/scheduleService';
import { ATTENDANCE_ROSTER_STATUSES } from '../../constants/attendance';
import { attendanceNoteForSave } from '../../lib/attendanceNote';
import { canGenerateAttendanceQr, canTakeAttendance } from '../../lib/businessRules';
import { filterRoster } from '../../lib/coachRoster';
import type { Attendance, AttendanceStatus, Enrollment, EvaluationValues } from '../../lib/types';

export function useCoachAttendance(scheduleId: string | undefined) {
  const queryClient = useQueryClient();
  const [markingMemberId, setMarkingMemberId] = useState<string | null>(null);
  const [evaluatingMemberId, setEvaluatingMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Buổi có thể nằm ngoài khoảng ngày của tab Điểm danh (mở từ Lịch dạy tuần khác hoặc chi tiết lớp) nên luôn tải theo id
  const scheduleQuery = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => getScheduleById(scheduleId!),
    enabled: Boolean(scheduleId),
  });
  const selectedSchedule = scheduleQuery.data?.data ?? null;

  const enrollmentsQuery = useQuery({
    queryKey: ['schedule-enrollments', scheduleId],
    queryFn: () => getScheduleEnrollments(scheduleId!),
    enabled: Boolean(scheduleId),
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', scheduleId],
    queryFn: () => getScheduleAttendance(scheduleId!),
    enabled: Boolean(scheduleId),
  });

  const markMutation = useMutation({
    mutationFn: (payload: { memberId: string; status: AttendanceStatus; note?: string }) =>
      createAttendance({ scheduleId: scheduleId!, ...payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', scheduleId] }),
  });

  // Mục tiêu + tiến độ của từng học viên và đánh giá của HLV — độc lập với điểm danh (web: Attendance.tsx)
  const evaluations = useScheduleEvaluations(scheduleId);
  const saveEvaluation = useSaveEvaluation(scheduleId);

  const roster: Enrollment[] = (enrollmentsQuery.data?.data ?? []).filter((e) =>
    ATTENDANCE_ROSTER_STATUSES.includes(e.status)
  );
  const visibleRoster = filterRoster(roster, search);
  const attendances: Attendance[] = attendanceQuery.data?.data ?? [];
  const recordFor = (memberId: string) => attendances.find((a) => a.memberId === memberId);

  const canWrite = selectedSchedule ? canTakeAttendance(selectedSchedule) : false;
  const canShowQr = selectedSchedule ? canGenerateAttendanceQr(selectedSchedule) : false;

  return {
    error: enrollmentsQuery.error ?? attendanceQuery.error ?? scheduleQuery.error,
    selectedSchedule,
    roster,
    /** Học viên sau khi lọc theo ô tìm kiếm (tên hoặc email) */
    visibleRoster,
    search,
    setSearch,
    rosterLoading: enrollmentsQuery.isLoading || attendanceQuery.isLoading || scheduleQuery.isLoading,
    recordFor,
    canWrite,
    canShowQr,
    /** Học viên đang được chọn để ghi điểm danh (mở modal chọn trạng thái) */
    markingMemberId,
    startMarking: (memberId: string) => setMarkingMemberId(memberId),
    cancelMarking: () => setMarkingMemberId(null),
    /** Ghi điểm danh cho học viên đang chọn; `note` là ghi chú đang gõ (trống thì không gửi, như web) */
    mark: (status: AttendanceStatus, note: string, onError: (e: unknown) => void) => {
      if (!markingMemberId || !canWrite || markMutation.isPending) return;
      markMutation.mutate({ memberId: markingMemberId, status, note: attendanceNoteForSave(note) }, { onError });
      setMarkingMemberId(null);
    },
    isMarking: markMutation.isPending,
    /** Tiến độ mục tiêu của một học viên ở buổi này (undefined khi chưa tải được) */
    evaluationFor: evaluations.itemFor,
    evaluationsError: evaluations.error,
    /** Sheet đánh giá tiến độ: chọn học viên → chấm 0–100% + lời dặn → lưu (BE báo cho hội viên) */
    evaluate: {
      memberId: evaluatingMemberId,
      item: evaluatingMemberId ? evaluations.itemFor(evaluatingMemberId) : undefined,
      isPending: saveEvaluation.isPending,
      error: saveEvaluation.error,
      start: (memberId: string) => {
        saveEvaluation.reset();
        setEvaluatingMemberId(memberId);
      },
      close: () => {
        if (!saveEvaluation.isPending) setEvaluatingMemberId(null);
      },
      save: (values: EvaluationValues) => {
        if (!evaluatingMemberId || saveEvaluation.isPending) return;
        saveEvaluation.mutate({ memberId: evaluatingMemberId, ...values }, { onSuccess: () => setEvaluatingMemberId(null) });
      },
    },
    onRefresh: async () => {
      await Promise.all([scheduleQuery.refetch(), enrollmentsQuery.refetch(), attendanceQuery.refetch(), evaluations.refetch()]);
    },
  };
}
