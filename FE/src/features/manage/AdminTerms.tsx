import { useState } from "react";
import "./term-editor.css";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Pencil, Trash2, ChevronDown, Clock, UserCheck, Sparkles, Building2, Lock } from "lucide-react";
import { api } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { Empty, ErrorState, Loading, Modal } from "../../shared/ui";
import type { Term, TermStatus } from "../../shared/generated";
import "./admin.css";

const STATUS_LABELS: Record<TermStatus, string> = {
  PLANNING: "Chưa bắt đầu",
  OPEN_REGISTRATION: "Mở đăng ký",
  IN_PROGRESS: "Đang diễn ra",
  CLOSED: "Đã đóng",
};

function fmtDate(d: string, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  });
}

type TermFormData = {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
  description?: string | null;
  facilityId?: string | null;
};

const vietnamOffsetMs = 7 * 60 * 60 * 1000;

function toDateInput(iso: string | undefined, withTime = false): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + vietnamOffsetMs).toISOString().slice(0, withTime ? 16 : 10);
}

function toISODate(value: string, original: string | undefined, endOfDay = false): string {
  const withTime = value.includes("T");
  if (original && value === toDateInput(original, withTime)) return original;
  const localTime = withTime ? `${value}:00` : `${value}T${endOfDay ? "23:59:59" : "00:00:00"}`;
  return new Date(`${localTime}+07:00`).toISOString();
}

/** Auto-generate a code from term name + year, e.g. "KY_THU_2026" */
function autoCode(name: string, startDate: string): string {
  const year = startDate ? startDate.slice(0, 4) : String(new Date().getFullYear());
  const slug = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 12);
  return slug ? `${slug}_${year}` : `TERM_${year}`;
}

function TermForm({
  initial,
  facilities,
  role = "ADMIN",
  onSave,
  onCancel,
  isPending,
  error,
}: {
  initial?: Partial<TermFormData>;
  facilities?: Array<{ id: string; name: string; code: string }>;
  role?: "ADMIN" | "MANAGER";
  onSave: (data: TermFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  error: unknown;
}) {
  const isManager = role === "MANAGER";
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(toDateInput(initial?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(initial?.endDate));
  const [regStart, setRegStart] = useState(toDateInput(initial?.registrationStartDate, true));
  const [regEnd, setRegEnd] = useState(toDateInput(initial?.registrationEndDate));
  const [facilityId, setFacilityId] = useState<string>(initial?.facilityId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [localError, setLocalError] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setLocalError("");
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length < 2) {
      setLocalError("Mã kỳ học bắt buộc (tối thiểu 2 ký tự).");
      return;
    }
    if (!name.trim() || !startDate || !endDate || !regStart || !regEnd) {
      setLocalError("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }
    if (endDate <= startDate) {
      setLocalError("Ngày kết thúc kỳ phải sau ngày bắt đầu.");
      return;
    }
    const registrationStartDate = toISODate(regStart, initial?.registrationStartDate);
    const registrationEndDate = toISODate(regEnd, initial?.registrationEndDate, true);
    if (Date.parse(registrationEndDate) <= Date.parse(registrationStartDate)) {
      setLocalError("Thời điểm đóng đăng ký phải sau thời điểm mở đăng ký.");
      return;
    }
    onSave({
      code: trimmedCode,
      name: name.trim(),
      startDate: toISODate(startDate, initial?.startDate),
      endDate: toISODate(endDate, initial?.endDate, true),
      registrationStartDate,
      registrationEndDate,
      description: description.trim() || undefined,
      ...(!isManager && { facilityId: facilityId || null }),
    });
  }

  const isEditing = Boolean(initial?.code);

  return (
    <form className="term-editor" onSubmit={handleSubmit} aria-busy={isPending}>
      <fieldset className="form-grid wide" disabled={isPending}>
        {/* Code */}
        <label>
          Mã kỳ học *
          <div style={{ display: "flex", gap: 8 }}>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VD: KY_THU_2026"
              maxLength={20}
              pattern="[A-Z0-9_]+"
              title="Chỉ dùng chữ hoa, số và dấu gạch dưới"
              style={{ flex: 1 }}
            />
            {!isEditing && (
              <button
                type="button"
                className="button"
                style={{ whiteSpace: "nowrap", fontSize: 12, padding: "0 10px" }}
                onClick={() => setCode(autoCode(name, startDate))}
              >
                Tự động
              </button>
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Chỉ chữ hoa A-Z, số 0-9, dấu _ (tối đa 20 ký tự)
          </span>
        </label>
        {/* Name */}
        <label className="wide">
          Tên kỳ học *
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Kỳ Thu 2026" />
        </label>
        {/* Term dates */}
        <label>
          Ngày bắt đầu kỳ *
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          Ngày kết thúc kỳ *
          <input type="date" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        {/* Registration window */}
        <label>
          Mở đăng ký từ (giờ Việt Nam) *
          <input type="datetime-local" required value={regStart} onChange={(e) => setRegStart(e.target.value)} />
        </label>
        <label>
          Đóng đăng ký vào *
          <input type="date" required value={regEnd} min={regStart.slice(0, 10)} onChange={(e) => setRegEnd(e.target.value)} />
        </label>
        {/* Facility assignment */}
        <label className="wide">
          Áp dụng cho Cơ sở (Chi nhánh)
          {isManager ? (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: 8,
                fontSize: 13,
                color: "#60a5fa",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Building2 size={16} />
              <span>Gán tự động cho Cơ sở bạn quản lý (theo quy định phân quyền Manager).</span>
            </div>
          ) : (
            <>
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                <option value="">Toàn hệ thống (Tất cả cơ sở)</option>
                {facilities?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Chọn một cơ sở cụ thể hoặc để &quot;Toàn hệ thống&quot; để áp dụng cho mọi chi nhánh.
              </span>
            </>
          )}
        </label>
        {/* Description */}
        <label className="wide">
          Ghi chú (tùy chọn)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về kỳ học…"
            rows={2}
            maxLength={500}
          />
        </label>
      </fieldset>
      {Boolean(localError || error) && (
        <div className="term-editor-error"><ErrorState error={localError ? new Error(localError) : error} /></div>
      )}
      <div className="modal-footer">
        <button type="button" className="button" disabled={isPending} onClick={onCancel}>Hủy</button>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? "Đang lưu…" : "Lưu kỳ học"}
        </button>
      </div>
    </form>
  );
}

export function AdminTerms({ role = "ADMIN" }: { role?: "ADMIN" | "MANAGER" } = {}) {
  const isManager = role === "MANAGER";
  const managerFacilityId = getFacilityId();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);
  const [deleting, setDeleting] = useState<Term | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [facilityFilter, setFacilityFilter] = useState<string>("");

  const facilitiesQuery = useQuery({
    queryKey: ["facilities-lookup"],
    queryFn: ({ signal }) =>
      api<Array<{ id: string; name: string; code: string }>>("GET /facilities", {
        signal,
      }),
  });
  const facilities = (facilitiesQuery.data as any)?.data ?? facilitiesQuery.data ?? [];

  const termsQuery = useQuery({
    queryKey: ["admin-terms", role, yearFilter, statusFilter, facilityFilter],
    queryFn: ({ signal }) =>
      api<Term[]>("GET /terms", {
        query: {
          ...(yearFilter ? { year: yearFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(isManager
            ? facilityFilter === "system"
              ? { facilityId: "system", exactFacility: "true" }
              : facilityFilter === "facility"
              ? { facilityId: managerFacilityId, exactFacility: "true" }
              : {}
            : facilityFilter
            ? { facilityId: facilityFilter, exactFacility: "true" }
            : {}),
          limit: "100",
        },
        signal,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: TermFormData) => api("POST /terms", { body: data }),
    onSuccess: () => {
      setCreating(false);
      void cache.invalidateQueries({ queryKey: ["admin-terms"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TermFormData & { id: string }) =>
      api("PATCH /terms/{id}", { params: { id: data.id }, body: data }),
    onSuccess: () => {
      setEditing(null);
      void cache.invalidateQueries({ queryKey: ["admin-terms"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api("DELETE /terms/{id}", { params: { id } }),
    onSuccess: () => {
      setDeleting(null);
      void cache.invalidateQueries({ queryKey: ["admin-terms"] });
    },
  });

  const terms: Term[] = (termsQuery.data as { data?: Term[] } | undefined)?.data ?? [];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i));

  return (
    <div className="workflow-page admin-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{isManager ? "QUẢN LÝ CƠ SỞ" : "QUẢN LÝ HỌC VỤ"}</div>
          <h1>Kỳ học / Học kỳ</h1>
          <p>
            {isManager
              ? "Xem các kỳ học áp dụng cho cơ sở của bạn và tạo/quản lý kỳ học cho chi nhánh."
              : "Tạo và quản lý các kỳ học, mở/đóng đăng ký lớp học theo từng kỳ."}
          </p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={18} /> Thêm kỳ học
        </button>
      </div>

      {/* Workflow Guide Card */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          <span>💡 Quy trình vận hành Kỳ học & Cơ sở:</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div style={{ background: "var(--surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <strong>1. Tạo kỳ học & Mở đăng ký sớm</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Cổng đăng ký tự mở vào giờ đã đặt. Chọn giờ mở trước ngày bắt đầu kỳ nếu muốn học viên đặt chỗ sớm.
            </p>
          </div>
          <div style={{ background: "var(--surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <strong>2. Gán lớp tại cơ sở vào kỳ</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Vào <em>Lịch học</em> tại cơ sở của bạn, khi xếp lịch chọn Kỳ học tương ứng để gắn các buổi học vào kỳ.
            </p>
          </div>
          <div style={{ background: "var(--surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <strong>3. Phân công Huấn luyện viên</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Cấp quyền bộ môn cho HLV tại <em>Người dùng</em>, sau đó vào <em>Lớp học</em> để phân công HLV chính/phụ.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          Năm học
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
          >
            <option value="">Tất cả năm</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          Trạng thái
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
          >
            <option value="">Tất cả</option>
            {(Object.entries(STATUS_LABELS) as [TermStatus, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        {isManager ? (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            Phạm vi
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
            >
              <option value="">Tất cả (Cơ sở & Hệ thống)</option>
              <option value="facility">Chỉ kỳ của cơ sở mình</option>
              <option value="system">Chỉ kỳ chung toàn hệ thống</option>
            </select>
          </label>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            Cơ sở
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
            >
              <option value="">Tất cả cơ sở</option>
              <option value="system">Toàn hệ thống (Chung)</option>
              {Array.isArray(facilities) && facilities.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
              ))}
            </select>
          </label>
        )}
        <ChevronDown size={16} style={{ color: "var(--muted)", marginLeft: -8 }} />
      </div>

      {termsQuery.isPending ? (
        <Loading />
      ) : termsQuery.isError ? (
        <ErrorState error={termsQuery.error} retry={() => termsQuery.refetch()} />
      ) : terms.length === 0 ? (
        <Empty text="Chưa có kỳ học nào. Nhấn 'Thêm kỳ học' để bắt đầu." />
      ) : (
        <div className="admin-facility-grid">
          {terms.map((term) => {
            const isEarlyReg =
              term.status === "OPEN_REGISTRATION" &&
              new Date(term.startDate).getTime() > Date.now();
            return (
              <article className="panel admin-facility-card" key={term.id}>
                <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 }}>
                  <span className="admin-card-icon"><Calendar size={22} /></span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {term.facility ? (
                      <span
                        style={{
                          height: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "0 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: "rgba(59, 130, 246, 0.12)",
                          color: "#60a5fa",
                          border: "1px solid rgba(59, 130, 246, 0.25)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Building2 size={13} /> {term.facility.name}
                      </span>
                    ) : (
                      <span
                        style={{
                          height: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "0 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: "rgba(107, 114, 128, 0.12)",
                          color: "#9ca3af",
                          border: "1px solid rgba(107, 114, 128, 0.25)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Building2 size={13} /> Toàn hệ thống
                      </span>
                    )}
                    {isEarlyReg ? (
                      <span
                        style={{
                          height: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "0 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: "rgba(16, 185, 129, 0.12)",
                          color: "#34d399",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Sparkles size={13} /> Mở đăng ký sớm
                      </span>
                    ) : (
                      <span
                        style={{
                          height: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "0 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          whiteSpace: "nowrap",
                          ...(term.status === "OPEN_REGISTRATION"
                            ? {
                                background: "rgba(16, 185, 129, 0.12)",
                                color: "#34d399",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                              }
                            : term.status === "IN_PROGRESS"
                            ? {
                                background: "rgba(59, 130, 246, 0.12)",
                                color: "#60a5fa",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                              }
                            : term.status === "CLOSED"
                            ? {
                                background: "rgba(239, 68, 68, 0.12)",
                                color: "#f87171",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                              }
                            : {
                                background: "rgba(156, 163, 175, 0.12)",
                                color: "#9ca3af",
                                border: "1px solid rgba(156, 163, 175, 0.25)",
                              }),
                        }}
                      >
                        {STATUS_LABELS[term.status]}
                      </span>
                    )}
                  </div>
                </div>
                <h2 style={{ margin: "10px 0 6px", fontSize: 18 }}>{term.name}</h2>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 13 }}>
                  <dt style={{ color: "var(--muted)", fontWeight: 500 }}>Phạm vi:</dt>
                  <dd style={{ margin: 0 }}>
                    {term.facility ? (
                      <strong style={{ color: "#60a5fa" }}>{term.facility.name} ({term.facility.code})</strong>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Toàn hệ thống (Tất cả chi nhánh)</span>
                    )}
                  </dd>
                  <dt style={{ color: "var(--muted)", fontWeight: 500 }}>Kỳ học:</dt>
                  <dd style={{ margin: 0 }}>{fmtDate(term.startDate)} → {fmtDate(term.endDate)}</dd>
                  <dt style={{ color: "var(--muted)", fontWeight: 500 }}>Đăng ký:</dt>
                  <dd style={{ margin: 0 }}>{fmtDate(term.registrationStartDate, true)} → {fmtDate(term.registrationEndDate)}</dd>
                  {term._count && (
                    <>
                      <dt style={{ color: "var(--muted)", fontWeight: 500 }}>Buổi học:</dt>
                      <dd style={{ margin: 0 }}>{term._count.schedules} buổi</dd>
                    </>
                  )}
                </dl>

                {/* Quick actions for operations */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px dashed var(--border)",
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    style={{ flex: 1, fontSize: 12, padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                    onClick={() => navigate(isManager ? "/manager/schedules" : "/admin/schedules")}
                    title="Xếp lịch các lớp học tại cơ sở cho kỳ này"
                  >
                    <Clock size={14} /> Xếp lịch
                  </button>
                  <button
                    type="button"
                    className="button"
                    style={{ flex: 1, fontSize: 12, padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                    onClick={() => navigate(isManager ? "/manager/classes" : "/admin/classes")}
                    title="Phân công HLV cho các lớp học"
                  >
                    <UserCheck size={14} /> Gán HLV
                  </button>
                </div>

                {(() => {
                  const isGlobal = !term.facilityId;
                  const canManage = !isManager || (!isGlobal && term.facilityId === managerFacilityId);
                  if (!canManage) {
                    return (
                      <div className="admin-card-footer" style={{ marginTop: 8, justifyContent: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Lock size={13} /> Kỳ học toàn hệ thống (Chỉ xem)
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="admin-card-footer" style={{ marginTop: 8 }}>
                      <button className="button" onClick={() => setEditing(term)}>
                        <Pencil size={16} /> Chỉnh sửa
                      </button>
                      <button
                        className="button danger"
                        onClick={() => { deleteMutation.reset(); setDeleting(term); }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={16} /> Xóa
                      </button>
                    </div>
                  );
                })()}
              </article>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {creating && (
        <Modal title={isManager ? "Thêm kỳ học cho cơ sở" : "Thêm kỳ học mới"} onClose={() => setCreating(false)} dismissible={!createMutation.isPending}>
          <TermForm
            facilities={facilities}
            role={role}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setCreating(false)}
            isPending={createMutation.isPending}
            error={createMutation.error}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Chỉnh sửa · ${editing.name}`} onClose={() => setEditing(null)} dismissible={!updateMutation.isPending}>
          <TermForm
            initial={editing}
            facilities={facilities}
            role={role}
            onSave={(data) => updateMutation.mutate({ ...data, id: editing.id })}
            onCancel={() => setEditing(null)}
            isPending={updateMutation.isPending}
            error={updateMutation.error}
          />
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <Modal
          title="Xóa kỳ học"
          dismissible={!deleteMutation.isPending}
          onClose={() => setDeleting(null)}
        >
          <p>
            Xóa kỳ học <strong>{deleting.name}</strong>?
            Nếu kỳ đã có lịch học, hãy chuyển trạng thái sang{" "}
            <strong>Đã đóng</strong> thay vì xóa.
          </p>
          {deleteMutation.error && <ErrorState error={deleteMutation.error} />}
          <div className="modal-footer">
            <button className="button" disabled={deleteMutation.isPending} onClick={() => setDeleting(null)}>
              Quay lại
            </button>
            <button
              className="button danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? "Đang xóa…" : "Xóa kỳ học"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
