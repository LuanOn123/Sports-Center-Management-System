// hooks/coach/useCoachChanges.ts
// Logic màn "Đổi HLV theo buổi": danh sách yêu cầu + lọc trạng thái, buổi có thể yêu cầu, gửi yêu cầu.
// Cache theo cơ sở hiện tại vì BE lọc theo X-Facility-Id.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { createCoachChange, getMyCoachChanges, getRequestableSessions } from '../../services/coachChangeService';
import { canSubmitCoachChange, coachChangeReasonError, filterCoachChanges } from '../../lib/coachChange';
import { showAlert } from '../../lib/alert';
import { COACH_CHANGE_TEXT, type CoachChangeFilter } from '../../constants/coachChanges';

const KEY = 'coach-changes';
const SESSIONS_KEY = 'coach-change-sessions';

export function useCoachChanges() {
  const { currentFacility } = useAuth();
  const facilityId = currentFacility?.id;
  const cache = useQueryClient();
  const [filter, setFilter] = useState<CoachChangeFilter>('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scheduleId, setScheduleId] = useState('');
  const [reason, setReason] = useState('');

  const list = useQuery({
    queryKey: [KEY, facilityId],
    queryFn: getMyCoachChanges,
    select: (res) => res.data,
  });
  const sessions = useQuery({
    queryKey: [SESSIONS_KEY, facilityId],
    queryFn: getRequestableSessions,
    select: (res) => res.data,
    enabled: sheetOpen,
  });
  const create = useMutation({
    mutationFn: () => createCoachChange({ scheduleId, reason: reason.trim() }),
    onSuccess: () => {
      setSheetOpen(false);
      showAlert('Đã gửi', COACH_CHANGE_TEXT.submitted);
      void cache.invalidateQueries({ queryKey: [KEY] });
      void cache.invalidateQueries({ queryKey: [SESSIONS_KEY] });
    },
  });

  const rows = useMemo(() => filterCoachChanges(list.data ?? [], filter), [list.data, filter]);
  const chosenSession = sessions.data?.find((s) => s.id === scheduleId);

  return {
    list, rows, filter, setFilter,
    sheet: {
      open: sheetOpen,
      show: () => { setScheduleId(''); setReason(''); create.reset(); setSheetOpen(true); },
      close: () => { if (!create.isPending) setSheetOpen(false); },
      sessions, scheduleId, setScheduleId, chosenSession,
      reason, setReason, reasonError: coachChangeReasonError(reason),
      canSubmit: canSubmitCoachChange(scheduleId, reason) && !create.isPending,
      submit: () => create.mutate(),
      create,
    },
    refresh: () => { void list.refetch(); },
  };
}

export type CoachChangeSheetState = ReturnType<typeof useCoachChanges>['sheet'];
