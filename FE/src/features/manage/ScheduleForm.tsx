import { CoachAssignmentForm } from "./CoachAssignmentForm";
import { hasEquipment } from "../../shared/forms/EquipmentFields";
import { useState, useId, useMemo, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Clock3, LoaderCircle, Repeat, AlertCircle } from "lucide-react";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { at, display } from "../../shared/config";
import { getFacilityId } from "../../shared/facility";
import { classSports } from "../../shared/sports";
import { canTeach, loadQualifiedCoaches } from "../../shared/coachEligibility";
import { ErrorState, Loading } from "../../shared/ui";
import "./ScheduleForm.css";

export interface ScheduleShift {
  id: string;
  name: string;
  startTime: string; // "07:00"
  endTime: string; // "09:00"
  label: string; // "07:00 – 09:00"
}

export const SCHEDULE_SHIFTS: ScheduleShift[] = [
  {
    id: "shift-1",
    name: "Ca 1",
    startTime: "07:00",
    endTime: "09:00",
    label: "07:00 – 09:00",
  },
  {
    id: "shift-2",
    name: "Ca 2",
    startTime: "09:00",
    endTime: "11:00",
    label: "09:00 – 11:00",
  },
  {
    id: "shift-3",
    name: "Ca 3",
    startTime: "11:00",
    endTime: "13:00",
    label: "11:00 – 13:00",
  },
  {
    id: "shift-4",
    name: "Ca 4",
    startTime: "13:00",
    endTime: "15:00",
    label: "13:00 – 15:00",
  },
  {
    id: "shift-5",
    name: "Ca 5",
    startTime: "15:00",
    endTime: "17:00",
    label: "15:00 – 17:00",
  },
  {
    id: "shift-6",
    name: "Ca 6",
    startTime: "17:00",
    endTime: "19:00",
    label: "17:00 – 19:00",
  },
  {
    id: "shift-7",
    name: "Ca 7",
    startTime: "19:00",
    endTime: "21:00",
    label: "19:00 – 21:00",
  },
];

// Weekday definitions (ISO: 1=Mon..7=Sun)
const WEEKDAYS = [
  { iso: 1, label: "T2", fullLabel: "Thứ Hai" },
  { iso: 2, label: "T3", fullLabel: "Thứ Ba" },
  { iso: 3, label: "T4", fullLabel: "Thứ Tư" },
  { iso: 4, label: "T5", fullLabel: "Thứ Năm" },
  { iso: 5, label: "T6", fullLabel: "Thứ Sáu" },
  { iso: 6, label: "T7", fullLabel: "Thứ Bảy" },
  { iso: 7, label: "CN", fullLabel: "Chủ Nhật" },
];

interface ClassItem {
  id: string;
  name: string;
  areaType: string;
  defaultRoomId?: string;
  capacity: number;
  sports?: { id: string; requirements?: { key: string; minimum: number }[] }[];
  isActive?: boolean;
}

interface RoomItem {
  capabilities?: { key: string; quantity: number }[];
  id: string;
  name: string;
  capacity: number;
  areaType: string;
  isActive?: boolean;
}

async function loadClassTeaching(classId: string, signal?: AbortSignal) {
  const [cls, coaches] = await Promise.all([
    api<RecordData>("GET /classes/{id}", { params: { id: classId }, signal }),
    loadQualifiedCoaches(signal),
  ]);
  if (cls.data.isActive === false) throw new Error("Lớp đã ngừng hoạt động. Không thể tạo lịch mới.");
  const sports = classSports(cls.data).map((sport) => sport.id);
  if (!sports.length || sports.some((id) => !id)) throw new Error("Lớp chưa có bộ môn. Hãy cập nhật bộ môn trước khi tạo lịch.");
  const eligible = coaches.filter((coach) => canTeach(sports, coach.sportIds));
  const assignments = Array.isArray(cls.data.coaches) ? cls.data.coaches as RecordData[] : [];
  const primary = assignments.find((assignment) => assignment.isPrimary === true);
  const primaryId = String(primary?.coachId || at(primary, "coach.id") || "");
  return { eligible, primary: eligible.find((coach) => coach.id === primaryId) };
}

function getVietnamToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function addDaysVietnam(baseDateStr: string, days: number): string {
  const d = new Date(`${baseDateStr || getVietnamToday()}T12:00:00+07:00`);
  d.setDate(d.getDate() + days);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

function formatFriendlyVietnamDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("vi-VN", {
    weekday: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const formatted = d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatted}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return day && month && year ? `${day}/${month}/${year}` : dateStr;
}

function toVietnamDatePart(isoString?: unknown): string {
  if (!isoString) return getVietnamToday();
  const d = new Date(String(isoString));
  if (Number.isNaN(d.getTime())) return getVietnamToday();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

function toVietnamTimePart(isoString?: unknown): string {
  if (!isoString) return "";
  const d = new Date(String(isoString));
  if (Number.isNaN(d.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(d);
}

/** Get ISO weekday (1=Mon..7=Sun) from a YYYY-MM-DD string */
function getIsoWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  const dow = d.getDay(); // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow;
}

/** Generate all YYYY-MM-DD dates in [fromDate, toDate] that fall on the selected weekdays */
function generateRecurringDates(
  fromDate: string,
  toDate: string,
  isoWeekdays: number[],
): string[] {
  if (!fromDate || !toDate || isoWeekdays.length === 0) return [];
  const result: string[] = [];
  let current = fromDate;
  // Safety limit: max 366 iterations
  let safety = 0;
  while (current <= toDate && safety < 500) {
    if (isoWeekdays.includes(getIsoWeekday(current))) {
      result.push(current);
    }
    current = addDaysVietnam(current, 1);
    safety++;
  }
  return result;
}

export function ScheduleForm({
  initial = {},
  mode = "create",
  onSuccess,
  onCancel,
  onBusyChange,
}: {
  initial?: RecordData;
  mode?: "create" | "edit";
  onSuccess: () => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const cache = useQueryClient();
  const facilityId = getFacilityId();
  const errorId = useId();
  const initialClassId = String(
    initial.classId ?? (initial.class as RecordData)?.id ?? "",
  );
  const initialRoomId = String(
    initial.roomId ?? (initial.room as RecordData)?.id ?? "",
  );
  const initialDate = toVietnamDatePart(initial.startTime);
  const initialStartTimeStr = toVietnamTimePart(initial.startTime);

  // Match initial shift if editing
  const matchedInitialShift = SCHEDULE_SHIFTS.find(
    (s) => s.startTime === initialStartTimeStr,
  );

  const [assignSupport, setAssignSupport] = useState(false);
  const [classId, setClassId] = useState(initialClassId);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [date, setDate] = useState(initialDate);
  const [termId, setTermId] = useState<string>(
    String(initial.termId ?? (initial.term as RecordData)?.id ?? ""),
  );
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>(() => {
    if (matchedInitialShift) return [matchedInitialShift.id];
    return mode === "edit" ? [SCHEDULE_SHIFTS[0].id] : [];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [coachId, setCoachId] = useState("");
  const [assignedClass, setAssignedClass] = useState("");

  // ── Recurring weekly schedule state ──
  const [recurringMode, setRecurringMode] = useState(false);
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]);
  const [recurringFrom, setRecurringFrom] = useState<string>("");
  const [recurringTo, setRecurringTo] = useState<string>("");

  // Fetch classes, rooms and terms
  const classesQuery = useQuery({
    queryKey: ["schedule-form", "classes"],
    queryFn: ({ signal }) => allPages<ClassItem>("GET /classes", { signal }),
  });
  const teaching = useQuery({
    queryKey: ["schedule-class-teaching", facilityId, classId],
    queryFn: ({ signal }) => loadClassTeaching(classId, signal),
    enabled: mode === "create" && !!classId,
  });
  const selectedCoachId = teaching.data?.primary?.id || coachId;
  const hasEligibleCoach = !!teaching.data?.eligible.some((coach) => coach.id === selectedCoachId);

  const roomsQuery = useQuery({
    queryKey: ["schedule-form", "rooms"],
    queryFn: ({ signal }) => allPages<RoomItem>("GET /rooms", { signal }),
  });

  const termsQuery = useQuery({
    queryKey: ["schedule-form", "terms"],
    queryFn: () => api<any>("GET /terms", {}),
  });

  const currentTermQuery = useQuery({
    queryKey: ["schedule-form", "current-term"],
    queryFn: () => api<any>("GET /terms/current", {}),
  });

  // Default to current term in create mode
  useEffect(() => {
    if (mode === "create" && !termId && currentTermQuery.data?.data?.id) {
      setTermId(String(currentTermQuery.data.data.id));
    }
  }, [mode, termId, currentTermQuery.data]);

  const termsList: any[] = useMemo(() => {
    const raw = termsQuery.data?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray((raw as any).terms)) return (raw as any).terms;
    return [];
  }, [termsQuery.data]);

  const selectedTerm = termsList.find((t) => String(t.id) === termId);
  const minTermDate = selectedTerm?.startDate
    ? String(selectedTerm.startDate).slice(0, 10)
    : undefined;
  const maxTermDate = selectedTerm?.endDate
    ? String(selectedTerm.endDate).slice(0, 10)
    : undefined;

  // When term changes or recurring mode is enabled, default the date range to term bounds
  useEffect(() => {
    if (recurringMode && selectedTerm) {
      if (!recurringFrom && minTermDate) setRecurringFrom(minTermDate);
      if (!recurringTo && maxTermDate) setRecurringTo(maxTermDate);
    }
  }, [recurringMode, selectedTerm, minTermDate, maxTermDate]);

  const isDateOutsideTerm = Boolean(
    selectedTerm &&
    date &&
    ((minTermDate && date < minTermDate) ||
      (maxTermDate && date > maxTermDate)),
  );

  const allClasses = (classesQuery.data?.data ?? []).filter(
    (c) => c.isActive !== false,
  );
  const allRooms = (roomsQuery.data?.data ?? []).filter(
    (r) => r.isActive !== false,
  );

  const selectedClass = allClasses.find((c) => String(c.id) === classId);

  // Eligible rooms based on class areaType if selected
  const eligibleRooms = useMemo(() => {
    if (!selectedClass?.areaType) return allRooms;
    return allRooms.filter(
      (r) =>
        r.areaType === selectedClass.areaType &&
        r.capacity >= selectedClass.capacity &&
        (selectedClass.sports ?? []).every((sport) =>
          hasEquipment(sport.requirements ?? [], r.capabilities, r.areaType),
        ),
    );
  }, [allRooms, selectedClass]);

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId);
    setCoachId("");
    setError(undefined);
    const cls = allClasses.find((c) => String(c.id) === newClassId);
    const compatible = allRooms.filter(
      (room) =>
        !cls ||
        (room.areaType === cls.areaType &&
          room.capacity >= cls.capacity &&
          (cls.sports ?? []).every((sport) =>
            hasEquipment(sport.requirements ?? [], room.capabilities, room.areaType),
          )),
    );
    const preferred = compatible.find((room) => room.id === cls?.defaultRoomId);
    setRoomId(
      preferred?.id ??
        compatible.find((room) => room.id === roomId)?.id ??
        compatible[0]?.id ??
        "",
    );
  };

  const toggleShift = (shiftId: string) => {
    if (mode === "edit") {
      setSelectedShiftIds([shiftId]);
    } else {
      setSelectedShiftIds((prev) =>
        prev.includes(shiftId)
          ? prev.filter((id) => id !== shiftId)
          : [...prev, shiftId],
      );
    }
    setError(undefined);
  };

  const selectAllShifts = () => {
    setSelectedShiftIds(SCHEDULE_SHIFTS.map((s) => s.id));
    setError(undefined);
  };

  const clearShifts = () => {
    setSelectedShiftIds([]);
  };

  const toggleWeekday = useCallback((iso: number) => {
    setRecurringWeekdays((prev) =>
      prev.includes(iso)
        ? prev.filter((d) => d !== iso)
        : [...prev, iso].sort((a, b) => a - b),
    );
    setError(undefined);
  }, []);

  const selectAllWeekdays = () =>
    setRecurringWeekdays(WEEKDAYS.map((w) => w.iso));
  const clearWeekdays = () => setRecurringWeekdays([]);

  // Compute selected shift objects sorted by time
  const selectedShifts = useMemo(() => {
    return SCHEDULE_SHIFTS.filter((s) => selectedShiftIds.includes(s.id)).sort(
      (a, b) => a.startTime.localeCompare(b.startTime),
    );
  }, [selectedShiftIds]);

  // Recurring dates preview
  const recurringDates = useMemo(() => {
    if (!recurringMode) return [];
    return generateRecurringDates(
      recurringFrom,
      recurringTo,
      recurringWeekdays,
    );
  }, [recurringMode, recurringFrom, recurringTo, recurringWeekdays]);

  // Validate recurring range against term
  const recurringFromOutsideTerm = Boolean(
    selectedTerm &&
    recurringFrom &&
    minTermDate &&
    maxTermDate &&
    (recurringFrom < minTermDate || recurringFrom > maxTermDate),
  );
  const recurringToOutsideTerm = Boolean(
    selectedTerm &&
    recurringTo &&
    minTermDate &&
    maxTermDate &&
    (recurringTo > maxTermDate || recurringTo < minTermDate),
  );

  // Earliest start and latest end for display
  const earliestStart = selectedShifts[0]?.startTime ?? "";
  const latestEnd = selectedShifts[selectedShifts.length - 1]?.endTime ?? "";

  const totalSchedulesToCreate = recurringMode
    ? recurringDates.length * selectedShifts.length
    : selectedShifts.length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!classId) {
      setError(new Error("Vui lòng chọn lớp học."));
      return;
    }
    if (!roomId) {
      setError(new Error("Vui lòng chọn phòng tập."));
      return;
    }
    if (selectedShifts.length === 0) {
      setError(new Error("Vui lòng chọn ít nhất 1 ca giờ hoạt động."));
      return;
    }
    if (mode === "create" && (!teaching.data || teaching.error || !hasEligibleCoach)) {
      setError(new Error("Vui lòng chọn HLV chính đủ chuyên môn cho lớp trước khi tạo lịch."));
      return;
    }

    if (recurringMode) {
      // Recurring mode validations
      if (recurringWeekdays.length === 0) {
        setError(
          new Error("Vui lòng chọn ít nhất 1 ngày trong tuần để lặp lịch."),
        );
        return;
      }
      if (!recurringFrom) {
        setError(new Error("Vui lòng chọn ngày bắt đầu cho lịch lặp."));
        return;
      }
      if (!recurringTo) {
        setError(new Error("Vui lòng chọn ngày kết thúc cho lịch lặp."));
        return;
      }
      if (recurringFrom > recurringTo) {
        setError(new Error("Ngày bắt đầu phải trước ngày kết thúc."));
        return;
      }
      if (+new Date(recurringTo) - +new Date(recurringFrom) > 366 * 86400000) {
        setError(new Error("Khoảng tạo lịch tối đa 366 ngày."));
        return;
      }
      if (recurringDates.length === 0) {
        setError(
          new Error(
            "Không có ngày nào phù hợp với các ngày trong tuần đã chọn trong khoảng thời gian này.",
          ),
        );
        return;
      }
      if (totalSchedulesToCreate > 500) {
        setError(
          new Error(
            `Số lịch tạo (${totalSchedulesToCreate}) quá lớn. Vui lòng rút ngắn khoảng thời gian hoặc giảm số ca.`,
          ),
        );
        return;
      }
    } else {
      // Single date mode validations
      if (!date) {
        setError(new Error("Vui lòng chọn ngày hoạt động."));
        return;
      }
      if (isDateOutsideTerm && selectedTerm) {
        setError(
          new Error(
            `Ngày hoạt động (${formatDisplayDate(date)}) phải nằm trong phạm vi kỳ học "${selectedTerm.name}" (${formatDisplayDate(minTermDate || "")} – ${formatDisplayDate(maxTermDate || "")}).`,
          ),
        );
        return;
      }
    }

    setBusy(true);
    onBusyChange?.(true);
    setError(undefined);

    try {
      if (mode === "create") {
        const fresh = await loadClassTeaching(classId);
        if (!fresh.eligible.some((coach) => coach.id === selectedCoachId)) throw new Error("HLV không còn đủ chuyên môn hoặc không còn hoạt động tại cơ sở. Hãy tải lại danh sách HLV.");
        if (fresh.primary && fresh.primary.id !== selectedCoachId) {
          void teaching.refetch();
          throw new Error("HLV chính của lớp vừa thay đổi. Kiểm tra lại phân công trước khi tạo lịch.");
        }
        if (!fresh.primary) {
          await api("POST /classes/{id}/coaches", { params: { id: classId }, body: { coachId: selectedCoachId, isPrimary: true } });
          setAssignedClass(classId);
        }
      }
      if (mode === "edit" && initial.id) {
        const shift = selectedShifts[0];
        const startTime = new Date(
          `${date}T${shift.startTime}:00+07:00`,
        ).toISOString();
        const endTime = new Date(
          `${date}T${shift.endTime}:00+07:00`,
        ).toISOString();
        await api("PATCH /class-schedules/{id}", {
          params: { id: String(initial.id) },
          body: { roomId, startTime, endTime },
        });
      } else {
        const dates = recurringMode ? recurringDates : [date];
        const schedules = dates.flatMap((day) =>
          selectedShifts.map((shift) => ({
            startTime: new Date(
              `${day}T${shift.startTime}:00+07:00`,
            ).toISOString(),
            endTime: new Date(`${day}T${shift.endTime}:00+07:00`).toISOString(),
          })),
        );
        await api("POST /class-schedules/batch", {
          body: { classId, roomId, termId: termId || undefined, schedules },
        });
      }
      onSuccess();
    } catch (caught) {
      setError(caught);
      if (mode === "create") {
        void cache.invalidateQueries({ queryKey: ["resource", "schedules"] });
        void cache.invalidateQueries({ queryKey: ["resource", "classes"] });
        void teaching.refetch();
      }
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  if (assignSupport && classId)
    return (
      <div>
        <p className="field-note">
          HLV phụ được phân công cho lớp và tham gia các buổi của lớp này. Hệ
          thống kiểm tra chuyên môn và lịch trùng.
        </p>
        <CoachAssignmentForm
          classId={classId}
          support
          onBusyChange={(value) => {
            setBusy(value);
            onBusyChange?.(value);
          }}
          onSuccess={() => {
            setAssignSupport(false);
            void classesQuery.refetch();
          }}
          onCancel={() => setAssignSupport(false)}
        />
      </div>
    );
  return (
    <form className="schedule-form" onSubmit={handleSubmit} aria-busy={busy}>
      <fieldset className="form-grid" disabled={busy}>
        {/* Class selector */}
        <label>
          Lớp học <b className="required">*</b>
          {classesQuery.isPending ? (
            <Loading variant="field" text="Đang tải lớp học…" />
          ) : (
            <select
              required
              aria-label="Lớp học"
              value={classId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={mode === "edit"}
            >
              <option value="">Chọn lớp học</option>
              {allClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({display(c.areaType)})
                </option>
              ))}
            </select>
          )}
        </label>

        {mode === "create" && (
          <div className="wide">
            <label>
              HLV chính phụ trách lớp <b className="required">*</b>
              <select
                aria-label="HLV chính phụ trách lớp"
                required
                value={teaching.data?.primary?.id || coachId}
                disabled={!classId || teaching.isFetching || !!teaching.error || !!teaching.data?.primary}
                onChange={(event) => { setCoachId(event.target.value); setError(undefined); }}
              >
                <option value="">{!classId ? "Chọn lớp học trước" : teaching.isFetching ? "Đang kiểm tra HLV…" : "Chọn HLV đúng chuyên môn"}</option>
                {teaching.data?.eligible.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
              </select>
            </label>
            {classId && teaching.error ? (
              <>
                <ErrorState error={teaching.error} />
                <button type="button" className="button small" onClick={() => teaching.refetch()}>Tải lại danh sách HLV</button>
              </>
            ) : classId && !teaching.isPending && (
              <p className="field-note" role="status">
                {teaching.data?.primary
                  ? "HLV chính hiện tại của lớp sẽ phụ trách các lịch mới. Có thể đổi HLV riêng từng buổi trong chi tiết lịch sau khi tạo."
                  : teaching.data?.eligible.length
                    ? "Lớp chưa có HLV chính phù hợp. Người được chọn sẽ được gán làm HLV chính của lớp trước khi tạo lịch."
                    : "Chưa có HLV đủ bộ môn để dạy lớp này. Cập nhật bộ môn giảng dạy tại Nhân sự cơ sở trước khi tạo lịch."}
              </p>
            )}
          </div>
        )}

        {classId && (
          <div className="wide">
            <button
              type="button"
              className="button"
              onClick={() => setAssignSupport(true)}
            >
              Phân công HLV phụ cho lớp
            </button>
          </div>
        )}
        {/* Room selector */}
        <label>
          Phòng tập <b className="required">*</b>
          {roomsQuery.isPending ? (
            <Loading variant="field" text="Đang tải phòng tập…" />
          ) : (
            <select
              required
              aria-label="Phòng tập"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Chọn phòng tập</option>
              {eligibleRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.capacity} chỗ ({display(r.areaType)})
                </option>
              ))}
            </select>
          )}
        </label>

        {/* Term selector */}
        <label className="wide">
          Kỳ học (Học kỳ)
          {termsQuery.isPending ? (
            <Loading variant="field" text="Đang tải danh sách kỳ học…" />
          ) : (
            <select
              aria-label="Kỳ học"
              value={termId}
              onChange={(e) => {
                setTermId(e.target.value);
                setRecurringFrom("");
                setRecurringTo("");
                setError(undefined);
              }}
            >
              <option value="">-- Tự chọn kỳ theo ngày học --</option>
              {termsList.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatDisplayDate(t.startDate?.slice(0, 10))} –{" "}
                  {formatDisplayDate(t.endDate?.slice(0, 10))})
                  {t.id === currentTermQuery.data?.data?.id
                    ? " [Kỳ hiện tại]"
                    : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {/* ── Recurring Mode Toggle ── */}
        {mode === "create" && (
          <div className="recurring-toggle-block wide">
            <button
              type="button"
              className={`recurring-toggle-btn ${recurringMode ? "active" : ""}`}
              onClick={() => {
                setRecurringMode((v) => !v);
                setError(undefined);
              }}
              aria-pressed={recurringMode}
            >
              <Repeat size={16} />
              <span>Lịch cố định theo tuần</span>
              <span
                className={`recurring-toggle-pill ${recurringMode ? "on" : "off"}`}
              >
                {recurringMode ? "BẬT" : "TẮT"}
              </span>
            </button>
            {!recurringMode && (
              <p className="recurring-hint">
                Bật để tạo lịch tự động lặp theo ngày trong tuần (ví dụ: mỗi Thứ
                2, Thứ 4, Thứ 6) trong một khoảng thời gian.
              </p>
            )}
          </div>
        )}

        {/* ── Single Date Mode ── */}
        {!recurringMode && (
          <div className="schedule-date-block wide">
            <label htmlFor="schedule-date-input">
              Ngày hoạt động <b className="required">*</b>
            </label>
            <div className="schedule-date-input-wrap">
              <div className="schedule-date-icon-box">
                <Calendar size={18} />
                <input
                  id="schedule-date-input"
                  type="date"
                  required
                  min={minTermDate}
                  max={maxTermDate}
                  aria-label="Ngày hoạt động"
                  className="schedule-date-input"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setError(undefined);
                  }}
                />
              </div>
              <div className="schedule-date-quick">
                <button
                  type="button"
                  className="schedule-quick-btn"
                  onClick={() => setDate(getVietnamToday())}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  className="schedule-quick-btn"
                  onClick={() => setDate(addDaysVietnam(getVietnamToday(), 1))}
                >
                  Ngày mai
                </button>
                <button
                  type="button"
                  className="schedule-quick-btn"
                  onClick={() =>
                    setDate(addDaysVietnam(date || getVietnamToday(), 7))
                  }
                >
                  +7 ngày
                </button>
              </div>
            </div>
            {date && (
              <div className="schedule-date-friendly">
                📅 {formatFriendlyVietnamDate(date)}
              </div>
            )}
            {selectedTerm && (
              <div
                className="schedule-term-hint"
                style={{
                  fontSize: "0.85rem",
                  marginTop: "6px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: isDateOutsideTerm ? "#fef2f2" : "#f0fdf4",
                  color: isDateOutsideTerm ? "#b91c1c" : "#166534",
                  border: `1px solid ${isDateOutsideTerm ? "#fecaca" : "#bbf7d0"}`,
                }}
              >
                {isDateOutsideTerm ? (
                  <span>
                    ⚠️ Cảnh báo: Ngày đã chọn nằm ngoài phạm vi kỳ học "
                    {selectedTerm.name}" ({formatDisplayDate(minTermDate || "")}{" "}
                    – {formatDisplayDate(maxTermDate || "")}).
                  </span>
                ) : (
                  <span>
                    ✓ Thuộc kỳ học "{selectedTerm.name}" (
                    {formatDisplayDate(minTermDate || "")} –{" "}
                    {formatDisplayDate(maxTermDate || "")}).
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Recurring Mode: Weekday picker + date range ── */}
        {recurringMode && mode === "create" && (
          <div className="recurring-config-block wide">
            {/* Weekday selector */}
            <div className="recurring-section">
              <div className="recurring-section-header">
                <strong>
                  Ngày trong tuần <b className="required">*</b>
                </strong>
                <small>Chọn các ngày lịch sẽ lặp lại hàng tuần</small>
                <div className="recurring-weekday-actions">
                  <button
                    type="button"
                    className="schedule-quick-btn"
                    onClick={selectAllWeekdays}
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    className="schedule-quick-btn"
                    onClick={clearWeekdays}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div
                className="recurring-weekday-grid"
                role="group"
                aria-label="Chọn ngày trong tuần"
              >
                {WEEKDAYS.map((wd) => {
                  const selected = recurringWeekdays.includes(wd.iso);
                  return (
                    <button
                      key={wd.iso}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={wd.fullLabel}
                      className={`recurring-weekday-btn ${selected ? "selected" : ""} ${wd.iso >= 6 ? "weekend" : ""}`}
                      onClick={() => toggleWeekday(wd.iso)}
                      title={wd.fullLabel}
                    >
                      <span className="wd-label">{wd.label}</span>
                      {selected && (
                        <Check size={10} strokeWidth={3} className="wd-check" />
                      )}
                    </button>
                  );
                })}
              </div>
              {recurringWeekdays.length > 0 && (
                <div className="recurring-weekday-summary">
                  Lặp vào:{" "}
                  <strong>
                    {recurringWeekdays
                      .map(
                        (iso) => WEEKDAYS.find((w) => w.iso === iso)?.fullLabel,
                      )
                      .join(", ")}
                  </strong>
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="recurring-section">
              <div className="recurring-section-header">
                <strong>
                  Khoảng thời gian áp dụng <b className="required">*</b>
                </strong>
                {selectedTerm && (
                  <small>
                    Kỳ học: {formatDisplayDate(minTermDate || "")} –{" "}
                    {formatDisplayDate(maxTermDate || "")}
                  </small>
                )}
              </div>
              <div className="recurring-date-range-row">
                <div className="recurring-date-field">
                  <label htmlFor="recurring-from-input">Từ ngày</label>
                  <div className="schedule-date-icon-box">
                    <Calendar size={16} />
                    <input
                      id="recurring-from-input"
                      type="date"
                      aria-label="Từ ngày"
                      className="schedule-date-input"
                      min={minTermDate}
                      max={maxTermDate || recurringTo || undefined}
                      value={recurringFrom}
                      onChange={(e) => {
                        setRecurringFrom(e.target.value);
                        setError(undefined);
                      }}
                    />
                  </div>
                  {recurringFromOutsideTerm && (
                    <span className="recurring-date-warn">⚠️ Ngoài kỳ học</span>
                  )}
                </div>
                <span className="recurring-range-sep">→</span>
                <div className="recurring-date-field">
                  <label htmlFor="recurring-to-input">Đến ngày</label>
                  <div className="schedule-date-icon-box">
                    <Calendar size={16} />
                    <input
                      id="recurring-to-input"
                      type="date"
                      aria-label="Đến ngày"
                      className="schedule-date-input"
                      min={recurringFrom || minTermDate || undefined}
                      max={maxTermDate}
                      value={recurringTo}
                      onChange={(e) => {
                        setRecurringTo(e.target.value);
                        setError(undefined);
                      }}
                    />
                  </div>
                  {recurringToOutsideTerm && (
                    <span className="recurring-date-warn">⚠️ Ngoài kỳ học</span>
                  )}
                </div>
              </div>
              {/* Quick fill from term */}
              {selectedTerm && (
                <button
                  type="button"
                  className="schedule-quick-btn"
                  style={{ marginTop: "6px" }}
                  onClick={() => {
                    if (minTermDate) setRecurringFrom(minTermDate);
                    if (maxTermDate) setRecurringTo(maxTermDate);
                  }}
                >
                  Dùng toàn bộ kỳ học
                </button>
              )}
            </div>

            {/* Preview panel */}
            {recurringDates.length > 0 && selectedShifts.length > 0 && (
              <div className="recurring-preview-panel">
                <div className="recurring-preview-header">
                  <Check size={15} />
                  <span>
                    Sẽ tạo <strong>{totalSchedulesToCreate} lịch</strong> (
                    {recurringDates.length} ngày × {selectedShifts.length} ca)
                  </span>
                </div>
                <div className="recurring-preview-dates">
                  {recurringDates.slice(0, 12).map((d) => (
                    <span key={d} className="recurring-preview-date-badge">
                      {formatDisplayDate(d)}
                    </span>
                  ))}
                  {recurringDates.length > 12 && (
                    <span className="recurring-preview-date-badge more">
                      +{recurringDates.length - 12} ngày nữa
                    </span>
                  )}
                </div>
              </div>
            )}

            {recurringWeekdays.length > 0 &&
              recurringFrom &&
              recurringTo &&
              recurringDates.length === 0 && (
                <div className="recurring-no-dates-warn">
                  <AlertCircle size={15} />
                  <span>
                    Không có ngày nào khớp với khoảng thời gian và các ngày
                    trong tuần đã chọn.
                  </span>
                </div>
              )}
          </div>
        )}

        {/* Component 2: Các ca giờ hoạt động từ 7:00 đến 21:00 (mỗi ca 2 tiếng) */}
        <div className="schedule-section wide">
          <div className="schedule-shifts-header">
            <div className="schedule-shifts-title">
              <strong>
                Ca giờ hoạt động <b className="required">*</b>
              </strong>
              <small>
                Khung giờ từ 07:00 đến 21:00 · Mỗi ca 2 tiếng (
                {mode === "edit" ? "Chọn 1 ca" : "Có thể chọn 1 hoặc nhiều ca"})
              </small>
            </div>
            {mode === "create" && (
              <div className="schedule-shifts-actions">
                <button
                  type="button"
                  className="schedule-quick-btn"
                  onClick={selectAllShifts}
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  className="schedule-quick-btn"
                  onClick={clearShifts}
                >
                  Bỏ chọn
                </button>
              </div>
            )}
          </div>

          <div
            className="schedule-shifts-grid"
            role="group"
            aria-label="Danh sách ca giờ hoạt động"
          >
            {SCHEDULE_SHIFTS.map((shift) => {
              const isSelected = selectedShiftIds.includes(shift.id);
              return (
                <button
                  key={shift.id}
                  type="button"
                  role={mode === "edit" ? "radio" : "checkbox"}
                  aria-checked={isSelected}
                  className={`schedule-shift-card ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleShift(shift.id)}
                >
                  <div className="schedule-shift-top">
                    <span className="schedule-shift-name">{shift.name}</span>
                    <span className="schedule-shift-duration">2 tiếng</span>
                  </div>
                  <div className="schedule-shift-time">
                    <Clock3 size={15} />
                    <span>{shift.label}</span>
                  </div>
                  <div className="schedule-shift-indicator">
                    <span className="schedule-shift-badge">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedShifts.length > 0 ? (
            <div className="schedule-summary-bar">
              <span>
                Đã chọn: <strong>{selectedShifts.length} ca</strong> (
                {selectedShifts.map((s) => `${s.name}: ${s.label}`).join(", ")})
              </span>
            </div>
          ) : (
            <p className="field-note danger-text">
              Vui lòng nhấp chọn ít nhất 1 ca giờ ở trên.
            </p>
          )}
        </div>

        {/* Start / End Summary fields for clear user visibility */}
        {!recurringMode && (
          <div className="schedule-time-overview wide">
            <label>
              Bắt đầu <b className="required">*</b>
              <input
                type="text"
                readOnly
                aria-label="Bắt đầu"
                value={
                  earliestStart
                    ? `${formatDisplayDate(date)} ${earliestStart}`
                    : "Chưa chọn ca giờ"
                }
              />
            </label>
            <label>
              Kết thúc <b className="required">*</b>
              <input
                type="text"
                readOnly
                aria-label="Kết thúc"
                value={
                  latestEnd
                    ? `${formatDisplayDate(date)} ${latestEnd}`
                    : "Chưa chọn ca giờ"
                }
              />
            </label>
          </div>
        )}
      </fieldset>

      {Boolean(error) && (
        <div id={errorId} tabIndex={-1}>
          <ErrorState error={error} />
        </div>
      )}
      {assignedClass === classId && error != null && (
        <p className="field-note" role="status">Đã gán HLV chính cho lớp. Phân công được giữ lại; bạn có thể sửa lỗi và thử tạo lịch lại.</p>
      )}

      <div className="modal-footer">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={
            busy ||
            classesQuery.isPending ||
            roomsQuery.isPending ||
            (mode === "create" && (!classId || teaching.isFetching || !!teaching.error || !hasEligibleCoach)) ||
            selectedShifts.length === 0 ||
            (recurringMode && recurringWeekdays.length === 0)
          }
        >
          {busy ? (
            <>
              <LoaderCircle size={18} className="spin" />
              {recurringMode
                ? `Đang tạo ${totalSchedulesToCreate} lịch…`
                : "Đang lưu…"}
            </>
          ) : (
            <>
              <Check size={18} />
              {recurringMode && totalSchedulesToCreate > 0
                ? `Tạo ${totalSchedulesToCreate} lịch`
                : "Lưu thay đổi"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
