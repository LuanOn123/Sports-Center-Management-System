// hooks/coach/useCoachTraining.ts
// Logic cho màn hình Điểm danh & Lịch dạy của Huấn luyện viên (100% Real API)

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoachClasses,
  getCoachSchedules,
  getScheduleEnrollments,
  getScheduleAttendance,
  createAttendance,
  updateAttendance,
} from '../../services/coachService';
import type { Enrollment, ClassSchedule, Attendance, AttendanceStatus, Class } from '../../lib/types';

export function useCoachTraining(coachId: string | undefined) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedule' | 'attendance'>('schedule');
  const [selectedSchedule, setSelectedSchedule] = useState<ClassSchedule | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);

  // 1. Lấy danh sách lớp HLV phụ trách từ API thật: GET /classes?coachId={coachId}
  const {
    data: classesData,
    isLoading: classesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ['coach-training-classes', coachId],
    queryFn: () => getCoachClasses(coachId!),
    enabled: Boolean(coachId),
  });

  const coachClasses: Class[] = classesData?.data ?? [];
  const classIds = useMemo(() => new Set(coachClasses.map((c) => c.id)), [coachClasses]);

  // 2. Lấy danh sách các ca dạy từ API thật: GET /class-schedules?status=SCHEDULED
  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ['coach-training-schedules'],
    queryFn: () => getCoachSchedules(),
  });

  // Lọc lịch dạy thuộc các lớp mà HLV này phụ trách
  const schedules = useMemo(() => {
    const rawSchedules: ClassSchedule[] = schedulesData?.data ?? [];
    if (coachClasses.length === 0) return [];
    return rawSchedules
      .filter((s) => classIds.has(s.classId))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [schedulesData, classIds, coachClasses.length]);

  // 3. Lấy danh sách học viên đăng ký ca học từ API thật: GET /enrollments/schedule/{scheduleId}
  const {
    data: scheduleEnrollmentsData,
    isLoading: enrollmentsLoading,
    refetch: refetchScheduleEnrollments,
  } = useQuery({
    queryKey: ['schedule-enrollments', selectedSchedule?.id],
    queryFn: () => getScheduleEnrollments(selectedSchedule!.id),
    enabled: Boolean(selectedSchedule?.id),
  });

  // 4. Lấy dữ liệu điểm danh ca học từ API thật: GET /attendance?scheduleId={scheduleId}
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ['attendance', selectedSchedule?.id],
    queryFn: () => getScheduleAttendance(selectedSchedule!.id),
    enabled: Boolean(selectedSchedule?.id),
  });

  // 5. Mutation tạo điểm danh: POST /attendance
  const { mutate: createAttMutation, isPending: creating } = useMutation({
    mutationFn: (payload: { scheduleId: string; memberId: string; status: AttendanceStatus }) =>
      createAttendance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', selectedSchedule?.id] });
    },
  });

  // 6. Mutation cập nhật điểm danh: PATCH /attendance/{id}
  const { mutate: updateAttMutation, isPending: updating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      updateAttendance(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', selectedSchedule?.id] });
    },
  });

  const enrollments: Enrollment[] = scheduleEnrollmentsData?.data ?? [];
  const attendances: Attendance[] = attendanceData?.data ?? [];

  const handleMarkAttendance = (memberId: string, existingId?: string, existingStatus?: AttendanceStatus) => {
    setSelectedMemberId(memberId);
    setSelectedAttendanceId(existingId ?? null);
    setShowStatusModal(true);
  };

  const handleSelectStatus = (status: AttendanceStatus) => {
    if (!selectedSchedule) return;
    setShowStatusModal(false);
    if (selectedAttendanceId) {
      updateAttMutation({ id: selectedAttendanceId, status });
    } else {
      createAttMutation({ scheduleId: selectedSchedule.id, memberId: selectedMemberId, status });
    }
  };

  const onRefresh = () => {
    refetchClasses();
    refetchSchedules();
    if (selectedSchedule) {
      refetchScheduleEnrollments();
      refetchAttendance();
    }
  };

  const isScheduleListLoading = classesLoading || schedulesLoading;

  return {
    activeTab,
    setActiveTab,
    selectedSchedule,
    setSelectedSchedule,
    showStatusModal,
    setShowStatusModal,
    schedules,
    attendances,
    enrollments,
    isScheduleListLoading,
    enrollmentsLoading,
    attendanceLoading,
    creating,
    updating,
    handleMarkAttendance,
    handleSelectStatus,
    onRefresh,
  };
}
