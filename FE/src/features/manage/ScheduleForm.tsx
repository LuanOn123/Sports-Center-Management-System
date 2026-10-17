import { useState, useId, useMemo, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Check, Clock3, LoaderCircle } from "lucide-react";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { display } from "../../shared/config";
import { ErrorState, Loading } from "../../shared/ui";
import "./ScheduleForm.css";

export interface ScheduleShift {
  id: string;
  name: string;
  startTime: string; // "07:00"
  endTime: string;   // "09:00"
  label: string;     // "07:00 – 09:00"
}

export const SCHEDULE_SHIFTS: ScheduleShift[] = [
  { id: "shift-1", name: "Ca 1", startTime: "07:00", endTime: "09:00", label: "07:00 – 09:00" },
  { id: "shift-2", name: "Ca 2", startTime: "09:00", endTime: "11:00", label: "09:00 – 11:00" },
  { id: "shift-3", name: "Ca 3", startTime: "11:00", endTime: "13:00", label: "11:00 – 13:00" },
  { id: "shift-4", name: "Ca 4", startTime: "13:00", endTime: "15:00", label: "13:00 – 15:00" },
  { id: "shift-5", name: "Ca 5", startTime: "15:00", endTime: "17:00", label: "15:00 – 17:00" },
  { id: "shift-6", name: "Ca 6", startTime: "17:00", endTime: "19:00", label: "17:00 – 19:00" },
  { id: "shift-7", name: "Ca 7", startTime: "19:00", endTime: "21:00", label: "19:00 – 21:00" },
];

interface ClassItem {
  id: string;
  name: string;
  areaType: string;
  defaultRoomId?: string;
  isActive?: boolean;
}

interface RoomItem {
  id: string;
  name: string;
  capacity: number;
  areaType: string;
  isActive?: boolean;
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

  // Fetch classes, rooms and terms
  const classesQuery = useQuery({
    queryKey: ["schedule-form", "classes"],
    queryFn: ({ signal }) => allPages<ClassItem>("GET /classes", { signal }),
  });

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
  const minTermDate = selectedTerm?.startDate ? String(selectedTerm.startDate).slice(0, 10) : undefined;
  const maxTermDate = selectedTerm?.endDate ? String(selectedTerm.endDate).slice(0, 10) : undefined;

  const isDateOutsideTerm = Boolean(
    selectedTerm &&
      date &&
      ((minTermDate && date < minTermDate) || (maxTermDate && date > maxTermDate)),
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
    return allRooms.filter((r) => r.areaType === selectedClass.areaType);
  }, [allRooms, selectedClass]);

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId);
    const cls = allClasses.find((c) => String(c.id) === newClassId);
    if (cls?.defaultRoomId) {
      setRoomId(String(cls.defaultRoomId));
    } else if (cls?.areaType) {
      // If current room is incompatible, clear or select first compatible room
      const compatible = allRooms.filter((r) => r.areaType === cls.areaType);
      if (!compatible.some((r) => String(r.id) === roomId)) {
        setRoomId(compatible[0]?.id ? String(compatible[0].id) : "");
      }
    }
  };

  const toggleShift = (shiftId: string) => {
    if (mode === "edit") {
      // In edit mode, only one shift is selected
      setSelectedShiftIds([shiftId]);
    } else {
      // In create mode, can select 1 or multiple shifts
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

  // Compute selected shift objects sorted by time
  const selectedShifts = useMemo(() => {
    return SCHEDULE_SHIFTS.filter((s) => selectedShiftIds.includes(s.id)).sort(
      (a, b) => a.startTime.localeCompare(b.startTime),
    );
  }, [selectedShiftIds]);

  // Earliest start and latest end for display
  const earliestStart = selectedShifts[0]?.startTime ?? "";
  const latestEnd = selectedShifts[selectedShifts.length - 1]?.endTime ?? "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!classId) {
      setError(new Error("Vui lòng chọn lớp học."));
      return;
    }
    if (!roomId) {
      setError(new Error("Vui lòng chọn phòng tập."));
      return;
    }
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
    if (selectedShifts.length === 0) {
      setError(new Error("Vui lòng chọn ít nhất 1 ca giờ hoạt động."));
      return;
    }

    setBusy(true);
    onBusyChange?.(true);
    setError(undefined);

    try {
      if (mode === "edit" && initial.id) {
        const shift = selectedShifts[0];
        const startTime = new Date(`${date}T${shift.startTime}:00+07:00`).toISOString();
        const endTime = new Date(`${date}T${shift.endTime}:00+07:00`).toISOString();
        await api("PATCH /class-schedules/{id}", {
          params: { id: String(initial.id) },
          body: { roomId, startTime, endTime },
        });
      } else {
        // Sequentially create schedules to avoid resource advisory lock conflicts
        for (const shift of selectedShifts) {
          const startTime = new Date(`${date}T${shift.startTime}:00+07:00`).toISOString();
          const endTime = new Date(`${date}T${shift.endTime}:00+07:00`).toISOString();
          await api("POST /class-schedules", {
            body: {
              classId,
              roomId,
              startTime,
              endTime,
              termId: termId || undefined,
            },
          });
        }
      }
      onSuccess();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

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
                setError(undefined);
              }}
            >
              <option value="">-- Không áp dụng kỳ học --</option>
              {termsList.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatDisplayDate(t.startDate?.slice(0, 10))} – {formatDisplayDate(t.endDate?.slice(0, 10))})
                  {t.id === currentTermQuery.data?.data?.id ? " [Kỳ hiện tại]" : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {/* Component 1: Chọn ngày tháng năm */}
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
                onClick={() => setDate(addDaysVietnam(date || getVietnamToday(), 7))}
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
                <span>⚠️ Cảnh báo: Ngày đã chọn nằm ngoài phạm vi kỳ học "{selectedTerm.name}" ({formatDisplayDate(minTermDate || "")} – {formatDisplayDate(maxTermDate || "")}).</span>
              ) : (
                <span>✓ Thuộc kỳ học "{selectedTerm.name}" ({formatDisplayDate(minTermDate || "")} – {formatDisplayDate(maxTermDate || "")}).</span>
              )}
            </div>
          )}
        </div>

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

        {/* Start / End Summary fields for clear user visibility and test contract */}
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
      </fieldset>

      {Boolean(error) && (
        <div id={errorId} tabIndex={-1}>
          <ErrorState error={error} />
        </div>
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
            selectedShifts.length === 0
          }
        >
          {busy ? (
            <>
              <LoaderCircle size={18} className="spin" />
              Đang lưu…
            </>
          ) : (
            <>
              <Check size={18} />
              Lưu thay đổi
            </>
          )}
        </button>
      </div>
    </form>
  );
}
