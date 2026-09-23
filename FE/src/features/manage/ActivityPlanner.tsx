import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Circle, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { at, display } from "../../shared/config";
import { ErrorState, Loading } from "../../shared/ui";

type AreaType = "INDOOR" | "OUTDOOR" | "POOL";
type Step = { label: string; state: "waiting" | "running" | "done" | "error"; detail?: string };
type Slot = { id: number; start: string; end: string };
const weekdays = [
  [1, "Thứ 2"], [2, "Thứ 3"], [3, "Thứ 4"], [4, "Thứ 5"],
  [5, "Thứ 6"], [6, "Thứ 7"], [0, "Chủ nhật"],
] as const;
function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function datesBetween(from: string, to: string, selected: number[]) {
  if (!from || !to || from > to) return [];
  const result: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const last = new Date(`${to}T12:00:00`);
  while (cursor <= last && result.length <= 180) {
    if (selected.includes(cursor.getDay())) result.push(localDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
export function ActivityPlanner({ role }: { role: "MANAGER" | "STAFF" }) {
  const cache = useQueryClient();
  const [sportMode, setSportMode] = useState<"existing" | "new">("existing");
  const [sportId, setSportId] = useState("");
  const [sportName, setSportName] = useState("");
  const [sportDescription, setSportDescription] = useState("");
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [classType, setClassType] = useState<"REGULAR" | "PREMIUM">("REGULAR");
  const [areaType, setAreaType] = useState<AreaType>("INDOOR");
  const [coachId, setCoachId] = useState("");
  const [supportCoachId, setSupportCoachId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [slots, setSlots] = useState<Slot[]>([
    { id: 1, start: "18:00", end: "19:00" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [createdClass, setCreatedClass] = useState<RecordData>();
  const [steps, setSteps] = useState<Step[]>([]);
  const sports = useQuery({ queryKey: ["planner", "sports"], queryFn: ({ signal }) => allPages<RecordData>("GET /sports", { query: { isActive: "true" }, signal }) });
  const rooms = useQuery({ queryKey: ["planner", "rooms"], queryFn: ({ signal }) => allPages<RecordData>("GET /rooms", { query: { isActive: "true" }, signal }) });
  const coaches = useQuery({ queryKey: ["planner", "coaches"], queryFn: ({ signal }) => allPages<RecordData>("GET /coaches", { signal }) });
  const dates = useMemo(() => datesBetween(fromDate, toDate, selectedDays), [fromDate, toDate, selectedDays]);
  const compatibleRooms = (rooms.data?.data || []).filter(
    (room) => room.areaType === areaType && Number(room.capacity) >= capacity,
  );
  const selectedSport = sports.data?.data.find((sport) => sport.id === sportId);
  const sportCompatible =
    sportMode === "new" ||
    !Array.isArray(selectedSport?.areaTypes) ||
    (selectedSport.areaTypes as unknown[]).includes(areaType);
  const validSlots =
    slots.length > 0 &&
    slots.every((slot) => slot.start < slot.end) &&
    slots.every(
      (slot, index) =>
        !slots.some(
          (other, otherIndex) =>
            index !== otherIndex &&
            slot.start < other.end &&
            slot.end > other.start,
        ),
    );
  const totalSchedules = dates.length * slots.length;
  const valid = Boolean(
    (sportMode === "new" ? sportName.trim().length >= 2 : sportId) &&
      className.trim().length >= 2 && capacity > 0 && capacity <= 200 &&
      sportCompatible && coachId && roomId && fromDate && toDate && fromDate <= toDate &&
      dates.length && validSlots && supportCoachId !== coachId,
  );
  function updateStep(index: number, patch: Partial<Step>) {
    setSteps((current) => current.map((step, i) => i === index ? { ...step, ...patch } : step));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(undefined); setCreatedClass(undefined);
    const labels = [
      sportMode === "new" ? "Tạo bộ môn" : "Dùng bộ môn đã chọn",
      "Tạo lớp học", "Phân công HLV chính",
      ...(supportCoachId ? ["Phân công HLV hỗ trợ"] : []),
      `Tạo ${totalSchedules} buổi lịch`,
    ];
    setSteps(labels.map((label) => ({ label, state: "waiting" })));
    let index = 0;
    try {
      let resolvedSportId = sportId;
      updateStep(index, { state: "running" });
      if (sportMode === "new") {
        const result = await api<RecordData>("POST /sports", { body: { name: sportName.trim(), description: sportDescription.trim() || undefined, areaTypes: [areaType] } });
        resolvedSportId = String(result.data.id);
      }
      updateStep(index++, { state: "done" });
      updateStep(index, { state: "running" });
      const created = await api<RecordData>("POST /classes", { body: { name: className.trim(), description: classDescription.trim() || undefined, sportIds: [resolvedSportId], capacity, classType, areaType } });
      setCreatedClass(created.data);
      const classId = String(created.data.id);
      updateStep(index++, { state: "done" });
      updateStep(index, { state: "running" });
      await api("POST /classes/{id}/coaches", { params: { id: classId }, body: { coachId, isPrimary: true } });
      updateStep(index++, { state: "done" });
      if (supportCoachId) {
        updateStep(index, { state: "running" });
        await api("POST /classes/{id}/coaches/support", { params: { id: classId }, body: { coachId: supportCoachId } });
        updateStep(index++, { state: "done" });
      }
      updateStep(index, { state: "running", detail: `0/${totalSchedules} buổi` });
      let createdCount = 0;
      for (const date of dates) {
        for (const slot of slots) {
          await api("POST /class-schedules", { body: {
            classId, roomId,
            startTime: new Date(`${date}T${slot.start}:00+07:00`).toISOString(),
            endTime: new Date(`${date}T${slot.end}:00+07:00`).toISOString(),
          } });
          createdCount += 1;
          updateStep(index, { detail: `${createdCount}/${totalSchedules} buổi` });
        }
      }
      updateStep(index, { state: "done", detail: `${totalSchedules}/${totalSchedules} buổi` });
      void cache.invalidateQueries({ queryKey: ["resource"] });
      void cache.invalidateQueries({ queryKey: ["planner"] });
    } catch (caught) {
      updateStep(index, { state: "error" });
      setError(caught);
    } finally { setBusy(false); }
  }
  if (sports.isPending || rooms.isPending || coaches.isPending) return <Loading variant="page" text="Đang chuẩn bị dữ liệu cho biểu mẫu…" />;
  const loadError = sports.error || rooms.error || coaches.error;
  if (loadError) return <ErrorState error={loadError} />;
  return (
    <div className="workflow-page planner-page">
      <div className="page-heading"><div><div className="eyebrow">MỘT FORM · TRỌN VẸN MỘT LỊCH HOẠT ĐỘNG</div><h1>Tạo lịch hoạt động nhanh</h1><p>Tạo bộ môn (nếu cần), lớp, phân công HLV và toàn bộ lịch lặp chỉ trong một lần nhập.</p></div></div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="planner-grid">
          <section className="panel planner-section"><span className="planner-number">1</span><div><h2>Bộ môn</h2><p>Chọn bộ môn có sẵn hoặc tạo mới.</p></div><div className="form-grid wide">
            <label>Phương án<select value={sportMode} onChange={(event) => setSportMode(event.target.value as "existing" | "new")}><option value="existing">Dùng bộ môn có sẵn</option>{role === "MANAGER" && <option value="new">Tạo bộ môn mới</option>}</select></label>
            {sportMode === "existing" ? <label>Bộ môn <b className="required">*</b><select value={sportId} onChange={(event) => setSportId(event.target.value)}><option value="">Chọn bộ môn</option>{sports.data.data.map((sport) => <option key={String(sport.id)} value={String(sport.id)}>{display(sport.name)}</option>)}</select></label> : <><label>Tên bộ môn <b className="required">*</b><input value={sportName} minLength={2} onChange={(event) => setSportName(event.target.value)} /></label><label className="wide">Mô tả bộ môn<textarea value={sportDescription} onChange={(event) => setSportDescription(event.target.value)} /></label></>}
            {role === "STAFF" && <p className="field-note wide">Lễ tân có thể dùng bộ môn sẵn có. Chỉ quản lý được tạo bộ môn mới.</p>}
          </div></section>
          <section className="panel planner-section"><span className="planner-number">2</span><div><h2>Thông tin lớp</h2><p>Khu vực quyết định phòng nào có thể sử dụng.</p></div><div className="form-grid wide">
            <label>Tên lớp <b className="required">*</b><input value={className} minLength={2} onChange={(event) => setClassName(event.target.value)} /></label>
            <label>Loại lớp<select value={classType} onChange={(event) => setClassType(event.target.value as "REGULAR" | "PREMIUM")}><option value="REGULAR">Tiêu chuẩn</option><option value="PREMIUM">Cao cấp</option></select></label>
            <label>Khu vực<select value={areaType} onChange={(event) => { setAreaType(event.target.value as AreaType); setRoomId(""); }}><option value="INDOOR">Trong nhà</option><option value="OUTDOOR">Ngoài trời</option><option value="POOL">Hồ bơi</option></select></label>
            <label>Sức chứa<input type="number" min={1} max={200} value={capacity} onChange={(event) => { setCapacity(Number(event.target.value)); setRoomId(""); }} /></label>
            <label className="wide">Mô tả lớp<textarea value={classDescription} onChange={(event) => setClassDescription(event.target.value)} /></label>
            {!sportCompatible && <p className="error wide" role="alert">Bộ môn đã chọn không hỗ trợ khu vực này.</p>}
          </div></section>
          <section className="panel planner-section"><span className="planner-number">3</span><div><h2>Huấn luyện viên & phòng</h2><p>Phòng được lọc theo khu vực và sức chứa.</p></div><div className="form-grid wide">
            <label>HLV chính <b className="required">*</b><select value={coachId} onChange={(event) => { setCoachId(event.target.value); if (supportCoachId === event.target.value) setSupportCoachId(""); }}><option value="">Chọn HLV chính</option>{coaches.data.data.map((coach) => { const id = at(coach, "coachProfile.id"); return id ? <option key={String(id)} value={String(id)}>{display(coach.fullName)}</option> : null; })}</select></label>
            <label>HLV hỗ trợ<select value={supportCoachId} onChange={(event) => setSupportCoachId(event.target.value)}><option value="">Không có</option>{coaches.data.data.map((coach) => { const id = at(coach, "coachProfile.id"); return id && id !== coachId ? <option key={String(id)} value={String(id)}>{display(coach.fullName)}</option> : null; })}</select></label>
            <label>Phòng tập <b className="required">*</b><select value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Chọn phòng phù hợp</option>{compatibleRooms.map((room) => <option key={String(room.id)} value={String(room.id)}>{display(room.name)} · {display(room.capacity)} chỗ</option>)}</select></label>
            {!compatibleRooms.length && <p className="field-note">Không có phòng đang hoạt động phù hợp khu vực và sức chứa.</p>}
          </div></section>
          <section className="panel planner-section"><span className="planner-number">4</span><div><h2>Lịch lặp</h2><p>Chọn khoảng ngày, nhiều thứ và một khung giờ cho mỗi buổi.</p></div><div className="form-grid wide">
            <label>Từ ngày <b className="required">*</b><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>Đến ngày <b className="required">*</b><input type="date" min={fromDate} value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <div className="wide"><span className="field-label">Các khung giờ trong mỗi ngày <b className="required">*</b></span><div className="slot-list">{slots.map((slot, slotIndex) => <div key={slot.id}><label>Slot {slotIndex + 1} bắt đầu<input type="time" value={slot.start} onChange={(event) => setSlots((current) => current.map((item) => item.id === slot.id ? { ...item, start: event.target.value } : item))} /></label><label>Slot {slotIndex + 1} kết thúc<input type="time" min={slot.start} value={slot.end} onChange={(event) => setSlots((current) => current.map((item) => item.id === slot.id ? { ...item, end: event.target.value } : item))} /></label><button type="button" className="icon-button danger-text" aria-label={`Xóa slot ${slotIndex + 1}`} disabled={slots.length === 1} onClick={() => setSlots((current) => current.filter((item) => item.id !== slot.id))}><Trash2 size={16} /></button></div>)}</div><button type="button" className="button small" onClick={() => setSlots((current) => [...current, { id: Math.max(...current.map((slot) => slot.id)) + 1, start: "19:00", end: "20:00" }])}><Plus size={15} /> Thêm slot giờ</button>{!validSlots && <p className="error" role="alert">Các slot phải có giờ kết thúc sau giờ bắt đầu và không được chồng lấn.</p>}</div>
            <div className="wide"><span className="field-label">Học vào các thứ <b className="required">*</b></span><div className="weekday-picker">{weekdays.map(([value, text]) => <label key={value}><input type="checkbox" checked={selectedDays.includes(value)} onChange={(event) => setSelectedDays((current) => event.target.checked ? [...current, value] : current.filter((day) => day !== value))} />{text}</label>)}</div></div>
            <div className="planner-preview wide"><CalendarDays size={18} /><span>{dates.length ? `${totalSchedules} buổi sẽ được tạo (${dates.length} ngày × ${slots.length} slot) · ${dates.slice(0, 3).map((date) => new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN")).join(", ")}${dates.length > 3 ? "…" : ""}` : "Chọn khoảng ngày và thứ học để xem số buổi."}</span></div>
          </div></section>
        </fieldset>
        {steps.length > 0 && <section className="panel planner-progress"><h2>Tiến độ tạo dữ liệu</h2>{steps.map((step) => <div key={step.label} className={step.state}>{step.state === "running" ? <LoaderCircle className="spin" size={18} /> : step.state === "done" ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span>{step.label}</span><small>{step.detail}</small></div>)}</section>}
        {error != null && <ErrorState error={error} />}
        {createdClass && error == null && !busy && <p className="success" role="status">Đã tạo lớp “{display(createdClass.name)}” và {totalSchedules} buổi lịch thành công.</p>}
        {createdClass && error != null && <p className="field-note">Lớp đã được tạo nhưng một bước sau đó chưa hoàn tất. Bạn có thể mở Quản lý lớp học/Lịch hoạt động để tiếp tục, dữ liệu đã tạo không bị gửi lại.</p>}
        <div className="planner-submit"><div><strong>{totalSchedules} buổi lịch</strong><small>BE vẫn kiểm tra trùng phòng, trùng HLV và tính tương thích.</small></div>{createdClass ? <button type="button" className="button" onClick={() => { setCreatedClass(undefined); setSteps([]); setError(undefined); setClassName(""); setClassDescription(""); setFromDate(""); setToDate(""); setSelectedDays([]); }}>Bắt đầu lịch khác</button> : <button className="button primary" disabled={!valid || busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Đang tạo dữ liệu…</> : "Tạo toàn bộ lịch hoạt động"}</button>}</div>
      </form>
    </div>
  );
}
