// hooks/coach/useCoachAttendance.ts
// Logic màn Điểm danh của HLV — theo FE web (FE/src/shared/Attendance.tsx):
// chỉ ghi khi đang trong cửa sổ điểm danh, bản ghi đã có thì chỉ xem (quản lý mới sửa),
// HLV không chọn "Vắng có phép".

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCoachSchedules } from './useCoachSchedules';
import { useSaveEvaluation, useScheduleEvaluations } from './useScheduleEvaluations';
import { getScheduleEnrollments } from '../../services/coachService';
import { createAttendance, getScheduleAttendance } from '../../services/attendanceService';
import { getScheduleById } from '../../services/scheduleService';
import {
  COACH_ATTENDANCE_FUTURE_DAYS, COACH_ATTENDANCE_PAST_DAYS,
} from '../../constants/schedule';
import { ATTENDANCE_ROSTER_STATUSES } from '../../constants/attendance';
import { canGenerateAttendanceQr, canTakeAttendance } from '../../lib/businessRules';
import { filterRoster } from '../../lib/coachRoster';
import { daysFromNow, endOfDay, startOfDay } from '../../lib/date';
import type { Attendance, AttendanceStatus, Enrollment } from '../../lib/types';

export function useCoachAttendance(coachId: string | undefined, initialScheduleId?: string) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(initialScheduleId ?? null);
  const [markingMemberId, setMarkingMemberId] = useState<string | null>(null);
  const [evaluatingMemberId, setEvaluatingMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Mở thẳng một buổi khi được điều hướng tới kèm scheduleId (từ Lịch dạy / chi tiết buổi)
  useEffect(() => {
    if (initialScheduleId) setSelectedId(initialScheduleId);
  }, [initialScheduleId]);

  const todayKey = startOfDay(new Date()).toISOString();
  const range = useMemo(
    () => ({
      startAfter: startOfDay(daysFromNow(-COACH_ATTENDANCE_PAST_DAYS)).toISOString(),
      startBefore: endOfDay(daysFromNow(COACH_ATTENDANCE_FUTURE_DAYS)).toISOString(),
    }),
    [todayKey]
  );
  const { schedules: allSchedules, isLoading: schedulesLoading, refetch: refetchSchedules, error: schedulesError } = useCoachSchedules(coachId, range);
  const schedules = allSchedules.filter((s) => s.status !== 'CANCELLED');

  // Buổi được chọn có thể nằm ngoài khoảng đã tải (mở từ Lịch dạy tuần khác) → tải riêng
  const fromList = schedules.find((s) => s.id === selectedId);
  const detailQuery = useQuery({
    queryKey: ['schedule', selectedId],
    queryFn: () => getScheduleById(selectedId!),
    enabled: Boolean(selectedId) && !fromList,
  });
  const selectedSchedule = fromList ?? detailQuery.data?.data ?? null;

  const enrollmentsQuery = useQuery({
    queryKey: ['schedule-enrollments', selectedId],
    queryFn: () => getScheduleEnrollments(selectedId!),
    enabled: Boolean(selectedId),
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', selectedId],
    queryFn: () => getScheduleAttendance(selectedId!),
    enabled: Boolean(selectedId),
  });

  const markMutation = useMutation({
    mutationFn: (payload: { memberId: string; status: AttendanceStatus }) =>
      createAttendance({ scheduleId: selectedId!, ...payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', selectedId] }),
  });

  // Mục tiêu + tiến độ của từng học viên và đánh giá của HLV — độc lập với điểm danh (web: Attendance.tsx)
  const evaluations = useScheduleEvaluations(selectedId);
  const saveEvaluation = useSaveEvaluation(selectedId);

  const roster: Enrollment[] = (enrollmentsQuery.data?.data ?? []).filter((e) =>
    ATTENDANCE_ROSTER_STATUSES.includes(e.status)
  );
  const visibleRoster = filterRoster(roster, search);
  const attendances: Attendance[] = attendanceQuery.data?.data ?? [];
  const recordFor = (memberId: string) => attendances.find((a) => a.memberId === memberId);

  const canWrite = selectedSchedule ? canTakeAttendance(selectedSchedule) : false;
  const canShowQr = selectedSchedule ? canGenerateAttendanceQr(selectedSchedule) : false;

  return {
    schedules,
    schedulesLoading,
    error: schedulesError ?? enrollmentsQuery.error ?? attendanceQuery.error ?? detailQuery.error,
    selectedSchedule,
    /** Đang ở chế độ xem một buổi (kể cả khi buổi còn đang tải) */
    hasSelection: Boolean(selectedId),
    selectSchedule: (id: string | null) => {
      setSelectedId(id);
      setSearch('');
    },
    roster,
    /** Học viên sau khi lọc theo ô tìm kiếm (tên hoặc email) */
    visibleRoster,
    search,
    setSearch,
    rosterLoading: enrollmentsQuery.isLoading || attendanceQuery.isLoading || detailQuery.isLoading,
    recordFor,
    canWrite,
    canShowQr,
    /** Học viên đang được chọn để ghi điểm danh (mở modal chọn trạng thái) */
    markingMemberId,
    startMarking: (memberId: string) => setMarkingMemberId(memberId),
    cancelMarking: () => setMarkingMemberId(null),
    mark: (status: AttendanceStatus, onError: (e: unknown) => void) => {
      if (!markingMemberId || !canWrite || markMutation.isPending) return;
      markMutation.mutate({ memberId: markingMemberId, status }, { onError });
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
      save: (progress: number, description: string | null) => {
        if (!evaluatingMemberId || saveEvaluation.isPending) return;
        saveEvaluation.mutate({ memberId: evaluatingMemberId, progress, description }, { onSuccess: () => setEvaluatingMemberId(null) });
      },
    },
    onRefresh: async () => {
      await refetchSchedules();
      if (selectedId) await Promise.all([enrollmentsQuery.refetch(), attendanceQuery.refetch(), evaluations.refetch()]);
    },
  };
}
