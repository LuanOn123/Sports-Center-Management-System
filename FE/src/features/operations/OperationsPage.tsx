import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { allPages as fetchPages } from "../../shared/pagedApi";
import { Empty, ErrorState, Loading, Modal, SchemaForm } from "../../shared/ui";
import { at, display } from "../../shared/config";
import "./operations.css";
import { attendanceReportData, AttendanceReportReview } from "./AttendanceReportReview";
type Kind =
  | "facilities"
  | "staff"
  | "slots"
  | "patterns"
  | "leave"
  | "issues"
  | "audit"
  | "orders"
  | "requirements";
const allPages = async (operation: string) =>
  (await fetchPages<RecordData>(operation)).data;
const sections: Record<Kind, [string, string]> = {
  facilities: ["Cơ sở", "/facilities"],
  staff: ["Phân công nhân sự", "/facilities/{facilityId}"],
  slots: ["Khung giờ học", "/slots"],
  patterns: ["Sinh lịch định kỳ", "/schedule-patterns"],
  leave: ["Nghỉ phép", "/leave-requests"],
  issues: ["Yêu cầu hỗ trợ", "/issues"],
  audit: ["Nhật ký hoạt động", "/audit-logs"],
  orders: ["Bán gói tại quầy", "/counter-orders"],
  requirements: ["Điều kiện giảng dạy", "/sports"],
};
const titleOf = (row: RecordData) =>
  String(
    row.name ||
      row.title ||
      at(row, "user.fullName") ||
      at(row, "class.name") ||
      at(row, "member.user.fullName") ||
      row.entity ||
      "Bản ghi",
  );
const requestStatusText = (value: unknown) =>
  (
    ({
      OPEN: "Mới tiếp nhận",
      IN_PROGRESS: "Đang xử lý",
      RESOLVED: "Đã giải quyết",
      CLOSED: "Đã đóng",
    }) as Record<string, string>
  )[String(value)] || display(value);
export function OperationsPage({ kind, role }: { kind: Kind; role: string }) {
  const cache = useQueryClient();
  const [modal, setModal] = useState<{
    operation: string;
    params?: Record<string, string>;
    initial?: RecordData;
  }>();
  const [decision, setDecision] = useState<RecordData>();
  const [error, setError] = useState<unknown>();
  const [moreAudit, setMoreAudit] = useState(0);
  const [requestStatus, setRequestStatus] = useState("");
  const [requestRole, setRequestRole] = useState("");
  const reviewRequests =
    role === "MANAGER" && (kind === "leave" || kind === "issues");
  const RequestHeading = reviewRequests ? "h2" : "h3";
  const [title, path] = sections[kind];
  const facilityId = getFacilityId();
  const q = useQuery({
    queryKey: ["operations", kind, facilityId, moreAudit],
    queryFn: ({ signal }) =>
      api<RecordData[] | RecordData>("GET " + path, {
        params: { facilityId },
        query: kind === "audit" ? { skip: String(moreAudit) } : {},
        signal,
      }),
  });
  const rows = Array.isArray(q.data?.data)
    ? q.data.data
    : kind === "staff"
      ? (q.data?.data?.staffs as RecordData[]) || []
      : [];
  const visibleRows = reviewRequests
    ? rows.filter(
        (row) =>
          (!requestStatus || row.status === requestStatus) &&
          (!requestRole ||
            (at(row, "requester.role") ||
              row.requesterRole ||
              (row.coachId ? "COACH" : "MEMBER")) === requestRole),
      )
    : rows;
  const admin = role === "ADMIN",
    manager = admin || role === "MANAGER",
    member = role === "MEMBER";
  const create =
    kind === "facilities" && admin
      ? "POST /facilities"
      : kind === "staff" && manager
        ? "POST /facilities/{facilityId}/staff"
        : kind === "slots" && manager
          ? "POST /slots"
          : kind === "leave" && role === "COACH"
            ? "POST /leave-requests"
            : kind === "issues" && member
              ? "POST /issues"
              : kind === "orders"
                ? "POST /counter-orders"
                : "";
  async function done() {
    setModal(undefined);
    setDecision(undefined);
    await cache.invalidateQueries();
  }
  async function remove(operation: string, params: Record<string, string>) {
    try {
      await api(operation, { params });
      await done();
    } catch (e) {
      setError(e);
    }
  }
  if (kind === "requirements")
    return <RequirementsPage admin={admin} manager={manager} />;
  return (
    <section className="workflow-page operations-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">VẬN HÀNH CƠ SỞ</div>
          <h1>{title}</h1>
          <p>
            {role === "MANAGER"
              ? "Dữ liệu của cơ sở bạn quản lý."
              : "Dữ liệu của cơ sở đang chọn."}
          </p>
        </div>
        {create && (
          <button
            className="button primary"
            onClick={() =>
              setModal({ operation: create, params: { facilityId } })
            }
          >
            Thêm mới
          </button>
        )}
      </div>
      {kind === "patterns" && manager && <PatternForm onSuccess={done} />}
      {reviewRequests && (
        <div className="panel manager-request-filters">
          <label>
            Trạng thái
            <select
              value={requestStatus}
              onChange={(e) => setRequestStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {(kind === "leave"
                ? ["PENDING", "APPROVED", "REJECTED"]
                : ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]
              ).map((value) => (
                <option key={value} value={value}>
                  {requestStatusText(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vai trò người gửi
            <select
              value={requestRole}
              onChange={(e) => setRequestRole(e.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              {(kind === "leave"
                ? ["COACH", "RECEPTIONIST"]
                : ["MEMBER", "COACH", "RECEPTIONIST", "MANAGER"]
              ).map((value) => (
                <option key={value} value={value}>
                  {display(value)}
                </option>
              ))}
            </select>
          </label>
          <p aria-live="polite">{visibleRows.length} yêu cầu</p>
        </div>
      )}
      {error != null && <ErrorState error={error} />}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !visibleRows.length ? (
        <Empty
          text={
            rows.length
              ? "Không có yêu cầu phù hợp với bộ lọc."
              : "Chưa có dữ liệu."
          }
        />
      ) : (
        <div className="operations-list">
          {visibleRows.map((row) => (
            <article className="panel" key={String(row.id)}>
              <RequestHeading>{titleOf(row)}</RequestHeading>
              {reviewRequests && (
                <p>
                  Người gửi:{" "}
                  {String(
                    at(row, "requester.fullName") ||
                      at(row, "user.fullName") ||
                      "Chưa có thông tin",
                  )}{" "}
                  ·{" "}
                  {display(
                    at(row, "requester.role") ||
                      row.requesterRole ||
                      (row.coachId ? "COACH" : "MEMBER"),
                  )}
                </p>
              )}
              {reviewRequests && row.decisionReason != null && (
                <p>Lý do quyết định: {String(row.decisionReason)}</p>
              )}
              <p>
                {reviewRequests && row.status
                  ? requestStatusText(row.status)
                  : display(row.status || row.role || row.action || row.code)}
              </p>
              {row.description != null && !attendanceReportData(row.description) && <p>{String(row.description)}</p>}
              {kind === "issues" && attendanceReportData(row.description) && <AttendanceReportReview issue={row} manager={role === "MANAGER"} onSuccess={done} />}
              {row.reason != null && <p>{String(row.reason)}</p>}
              {row.response != null && <p>Phản hồi: {String(row.response)}</p>}
              {row.startTime != null && (
                <p>
                  {display(row.startTime)} → {display(row.endTime)}
                </p>
              )}
              {row.startMinute != null && (
                <p>
                  {clock(Number(row.startMinute))} –{" "}
                  {clock(Number(row.endMinute))}
                </p>
              )}
              {row.amount != null && (
                <p>{Number(row.amount).toLocaleString("vi-VN")} đ</p>
              )}
              {kind === "audit" && (
                <>
                  <p>
                    Người thực hiện: {String(row.actorId)} ·{" "}
                    {display(row.createdAt)}
                  </p>
                  <details>
                    <summary>Nội dung thay đổi</summary>
                    <pre>
                      {JSON.stringify(
                        { before: row.before, after: row.after },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </>
              )}
              <div className="operations-actions">
                {kind === "facilities" && admin && (
                  <button
                    className="button"
                    onClick={() =>
                      setModal({
                        operation: "PUT /facilities/{facilityId}",
                        params: { facilityId: String(row.id) },
                        initial: row,
                      })
                    }
                  >
                    Chỉnh sửa
                  </button>
                )}
                {kind === "staff" &&
                  manager &&
                  (admin || row.role !== "MANAGER") && (
                    <button
                      className="button"
                      onClick={() =>
                        void remove(
                          "DELETE /facilities/{facilityId}/staff/{userId}/{role}",
                          {
                            facilityId,
                            userId: String(row.userId),
                            role: String(row.role),
                          },
                        )
                      }
                    >
                      Gỡ phân công
                    </button>
                  )}
                {kind === "leave" && manager && row.status === "PENDING" && (
                  <button className="button" onClick={() => setDecision(row)}>
                    Xử lý đơn nghỉ
                  </button>
                )}
                {kind === "issues" && !member && !attendanceReportData(row.description) && (
                  <button
                    className="button"
                    onClick={() =>
                      setModal({
                        operation: "PATCH /issues/{id}",
                        params: { id: String(row.id) },
                        initial: row,
                      })
                    }
                  >
                    Phản hồi
                  </button>
                )}
                {kind === "issues" && member && row.status === "OPEN" && (
                  <>
                    <button
                      className="button"
                      onClick={() =>
                        setModal({
                          operation: "PUT /issues/{id}",
                          params: { id: String(row.id) },
                          initial: row,
                        })
                      }
                    >
                      Sửa yêu cầu
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        void remove("DELETE /issues/{id}", {
                          id: String(row.id),
                        })
                      }
                    >
                      Xóa yêu cầu
                    </button>
                  </>
                )}
                {kind === "orders" && row.status === "PENDING" && (
                  <button
                    className="button primary"
                    onClick={() =>
                      setModal({
                        operation: "POST /counter-orders/{id}/confirm",
                        params: { id: String(row.id) },
                      })
                    }
                  >
                    Xác nhận đã thu tiền
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {kind === "audit" && (
        <div className="operations-actions">
          <button
            className="button"
            disabled={!moreAudit}
            onClick={() => setMoreAudit(Math.max(0, moreAudit - 100))}
          >
            Mới hơn
          </button>
          <button
            className="button"
            disabled={rows.length < 100}
            onClick={() => setMoreAudit(moreAudit + 100)}
          >
            Cũ hơn
          </button>
        </div>
      )}
      {modal && (
        <Modal title={title} onClose={() => setModal(undefined)}>
          <OperationForm
            {...modal}
            managerOnly={!admin}
            onSuccess={done}
            onCancel={() => setModal(undefined)}
          />
        </Modal>
      )}
      {decision && (
        <Modal
          title="Xử lý đơn nghỉ phép"
          onClose={() => setDecision(undefined)}
        >
          <LeaveDecision leave={decision} onSuccess={done} />
        </Modal>
      )}
    </section>
  );
}
function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
function OperationForm(props: {
  operation: string;
  params?: Record<string, string>;
  initial?: RecordData;
  managerOnly: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const q = useQuery({
    queryKey: ["operations-choices", props.operation],
    queryFn: async () => {
      const [users, plans, members] = await Promise.all([
        props.operation.includes("/staff")
          ? allPages("GET /staff-candidates")
          : [],
        props.operation.includes("/counter-orders") &&
        !props.operation.includes("confirm")
          ? allPages("GET /membership-plans")
          : [],
        props.operation.includes("/counter-orders") &&
        !props.operation.includes("confirm")
          ? allPages("GET /members")
          : [],
      ]);
      return {
        userId: users
          .filter((u) =>
            [
              "COACH",
              "RECEPTIONIST",
              ...(props.managerOnly ? [] : ["MANAGER"]),
            ].includes(String(u.role)),
          )
          .map((u) => ({
            value: String(u.id),
            label: `${titleOf(u)} · ${display(u.role)}`,
          })),
        planId: plans
          .filter((p) => p.tier !== "FREE" && p.isActive)
          .map((p) => ({ value: String(p.id), label: titleOf(p) })),
        memberId: members.map((m) => ({
          value: String(m.id),
          label: titleOf((m.user as RecordData) || m),
        })),
      };
    },
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  if (props.operation === "POST /slots")
    return <SlotForm onSuccess={props.onSuccess} />;
  return (
    <SchemaForm
      {...props}
      choices={{
        ...q.data,
        ...(props.managerOnly
          ? {
              role: [
                { value: "COACH", label: "Huấn luyện viên" },
                { value: "RECEPTIONIST", label: "Lễ tân" },
              ],
            }
          : {}),
      }}
    />
  );
}
function SlotForm({ onSuccess }: { onSuccess: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <form
      className="operations-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const minute = (name: string) =>
          String(data.get(name))
            .split(":")
            .map(Number)
            .reduce((hour, minute) => hour * 60 + minute);
        setBusy(true);
        try {
          await api("POST /slots", {
            body: {
              name: data.get("name"),
              startMinute: minute("start"),
              endMinute: minute("end"),
            },
          });
          onSuccess();
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Tên khung giờ
          <input required name="name" />
        </label>
        <label>
          Bắt đầu
          <input required type="time" name="start" />
        </label>
        <label>
          Kết thúc
          <input required type="time" name="end" />
        </label>
        <button className="button primary">
          {busy ? "Đang lưu…" : "Tạo khung giờ"}
        </button>
      </fieldset>
      {error != null && <ErrorState error={error} />}
    </form>
  );
}
function PatternForm({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["pattern-resources"],
    queryFn: async () => {
      const [classes, rooms, slots] = await Promise.all([
        allPages("GET /classes"),
        allPages("GET /rooms"),
        api<RecordData[]>("GET /slots"),
      ]);
      return { classes, rooms, slots: slots.data };
    },
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  return (
    <form
      className="panel operations-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await api("POST /schedule-patterns", {
            body: {
              classId: data.get("classId"),
              roomId: data.get("roomId"),
              slotId: data.get("slotId"),
              weekdays: data.getAll("weekdays").map(Number),
              startDate: data.get("startDate"),
              endDate: data.get("endDate"),
            },
          });
          onSuccess();
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Tạo các buổi học định kỳ</h2>
      <fieldset disabled={busy}>
        {(
          [
            ["classId", "Lớp học", q.data.classes],
            ["roomId", "Phòng tập", q.data.rooms],
            ["slotId", "Khung giờ", q.data.slots],
          ] as [string, string, RecordData[]][]
        ).map(([name, label, options]) => (
          <label key={name}>
            {label}
            <select name={name} required>
              <option value="">Chọn {label.toLowerCase()}</option>
              {options
                .filter((o) => o.isActive !== false)
                .map((o) => (
                  <option key={String(o.id)} value={String(o.id)}>
                    {titleOf(o)}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <label>
          Từ ngày
          <input type="date" name="startDate" required />
        </label>
        <label>
          Đến ngày
          <input type="date" name="endDate" required />
        </label>
        <div className="operations-actions">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <label key={day}>
              <input type="checkbox" name="weekdays" value={day} />
              {day === 7 ? "Chủ nhật" : `Thứ ${day + 1}`}
            </label>
          ))}
        </div>
        <p>
          Toàn bộ lịch được kiểm tra phòng, chuyên môn và trùng giờ trước khi
          lưu.
        </p>
        <button className="button primary">
          {busy ? "Đang sinh lịch…" : "Sinh lịch"}
        </button>
      </fieldset>
      {error != null && <ErrorState error={error} />}
    </form>
  );
}
function LeaveDecision({
  leave,
  onSuccess,
}: {
  leave: RecordData;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState("APPROVED"),
    [reason, setReason] = useState(""),
    [resolutions, setResolutions] = useState<Record<string, RecordData>>({}),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["leave-affected", leave.id],
    queryFn: async () => {
      const [sessions, coaches, rooms] = await Promise.all([
        api<RecordData[]>("GET /leave-requests/{id}/affected", {
          params: { id: String(leave.id) },
        }),
        leave.coachId ? allPages("GET /coaches") : [],
        leave.coachId ? allPages("GET /rooms") : [],
      ]);
      return { sessions: sessions.data, coaches, rooms };
    },
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const set = (id: string, field: string, value: string) =>
    setResolutions((old) => ({ ...old, [id]: { ...old[id], [field]: value } }));
  return (
    <form
      className="operations-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const payload = q.data.sessions.map((s) => {
            const r = resolutions[String(s.id)] || { action: "CANCEL" };
            return {
              scheduleId: s.id,
              ...r,
              ...(r.startTime
                ? {
                    startTime: new Date(String(r.startTime)).toISOString(),
                    endTime: new Date(String(r.endTime)).toISOString(),
                  }
                : {}),
            };
          });
          await api("PATCH /leave-requests/{id}", {
            params: { id: String(leave.id) },
            body: {
              status,
              reason,
              resolutions: status === "APPROVED" ? payload : [],
            },
          });
          onSuccess();
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <p>{String(leave.reason)}</p>
        <label>
          Quyết định
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="APPROVED">Duyệt nghỉ</option>
            <option value="REJECTED">Từ chối</option>
          </select>
        </label>
        <label>
          Lý do
          <input
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {status === "APPROVED" &&
          q.data.sessions.map((s) => {
            const id = String(s.id),
              r = resolutions[id] || { action: "CANCEL" };
            return (
              <section className="panel" key={id}>
                <h3>{titleOf(s)}</h3>
                <p>
                  {display(s.startTime)} – {display(s.endTime)}
                </p>
                <label>
                  Cách xử lý
                  <select
                    value={String(r.action)}
                    onChange={(e) =>
                      setResolutions((old) => ({
                        ...old,
                        [id]: { action: e.target.value },
                      }))
                    }
                  >
                    <option value="CANCEL">Hủy buổi học</option>
                    <option value="REPLACE">Đổi huấn luyện viên</option>
                    <option value="MOVE">Dời buổi học</option>
                  </select>
                </label>
                {r.action === "REPLACE" && (
                  <label>
                    Huấn luyện viên thay thế
                    <select
                      required
                      value={String(r.coachId || "")}
                      onChange={(e) => set(id, "coachId", e.target.value)}
                    >
                      <option value="">Chọn huấn luyện viên</option>
                      {q.data.coaches
                        .filter(
                          (c) => at(c, "coachProfile.id") !== leave.coachId,
                        )
                        .map((c) => (
                          <option
                            key={String(c.id)}
                            value={String(at(c, "coachProfile.id"))}
                          >
                            {titleOf(c)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {r.action === "MOVE" && (
                  <>
                    <label>
                      Bắt đầu
                      <input
                        required
                        type="datetime-local"
                        onChange={(e) => set(id, "startTime", e.target.value)}
                      />
                    </label>
                    <label>
                      Kết thúc
                      <input
                        required
                        type="datetime-local"
                        onChange={(e) => set(id, "endTime", e.target.value)}
                      />
                    </label>
                    <label>
                      Phòng
                      <select
                        value={String(r.roomId || s.roomId)}
                        onChange={(e) => set(id, "roomId", e.target.value)}
                      >
                        {q.data.rooms.map((room) => (
                          <option value={String(room.id)} key={String(room.id)}>
                            {titleOf(room)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </section>
            );
          })}
        <button className="button primary">
          {busy
            ? "Đang lưu…"
            : leave.coachId
              ? "Lưu quyết định và xử lý lịch"
              : "Lưu quyết định"}
        </button>
      </fieldset>
      {error != null && <ErrorState error={error} />}
    </form>
  );
}
function RequirementsPage({
  admin,
  manager,
}: {
  admin: boolean;
  manager: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState("rooms"),
    [id, setId] = useState(""),
    [values, setValues] = useState<{ key: string; quantity: number }[]>([]),
    [sports, setSports] = useState<string[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["requirements-resources", type],
    queryFn: () => allPages("GET /" + type),
  });
  const subjects = useQuery({
    queryKey: ["requirement-subjects"],
    queryFn: () => allPages("GET /sports"),
    enabled: type === "coaches",
  });
  async function choose(id: string) {
    setId(id);
    setError(undefined);
    setLoaded(false);
    setValues([]);
    setSports([]);
    if (!id) return;
    setBusy(true);
    try {
      if (type === "coaches") {
        const r = await api<RecordData[]>("GET /coaches/{id}/specializations", {
          params: { id },
        });
        setSports(r.data.map((s) => String(s.sportId)));
      } else {
        const r = await api<RecordData>("GET /" + type + "/{id}", {
          params: { id },
        });
        const rows = (r.data[
          type === "rooms" ? "capabilities" : "requirements"
        ] || []) as RecordData[];
        setValues(
          rows.map((v) => ({
            key: String(v.key),
            quantity: Number(v.quantity ?? v.minimum),
          })),
        );
      }
      setLoaded(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workflow-page operations-page">
      <h1>Điều kiện giảng dạy</h1>
      <form
        className="panel operations-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            if (
              !id ||
              new Set(values.map((v) => v.key.trim())).size !== values.length
            )
              throw new Error(
                "Chọn đối tượng và dùng tên điều kiện khác nhau.",
              );
            await api(
              type === "rooms"
                ? "PUT /rooms/{id}/capabilities"
                : type === "sports"
                  ? "PUT /subjects/{id}/requirements"
                  : "PUT /coaches/{id}/specializations",
              {
                params: { id },
                body:
                  type === "coaches"
                    ? { sportIds: sports }
                    : {
                        values: Object.fromEntries(
                          values.map((v) => [v.key.trim(), v.quantity]),
                        ),
                      },
              },
            );
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Cấu hình
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setId("");
                setValues([]);
              }}
            >
              <option value="rooms">Thiết bị phòng</option>
              {admin && (
                <>
                  <option value="sports">Yêu cầu bộ môn</option>
                </>
              )}
              {manager && (
                <option value="coaches">Chuyên môn huấn luyện viên</option>
              )}
            </select>
          </label>
          {q.isPending ? (
            <Loading />
          ) : q.error ? (
            <ErrorState error={q.error} />
          ) : (
            <label>
              {type === "rooms"
                ? "Phòng tập"
                : type === "sports"
                  ? "Bộ môn"
                  : "Huấn luyện viên"}
              <select
                required
                value={id}
                onChange={(e) => void choose(e.target.value)}
              >
                <option value="">Chọn đối tượng</option>
                {q.data.map((row) => (
                  <option
                    key={String(row.id)}
                    value={String(
                      type === "coaches" ? at(row, "coachProfile.id") : row.id,
                    )}
                  >
                    {titleOf(row)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {type === "coaches" ? (
            subjects.data?.map((s) => (
              <label key={String(s.id)}>
                <input
                  type="checkbox"
                  checked={sports.includes(String(s.id))}
                  onChange={(e) =>
                    setSports((old) =>
                      e.target.checked
                        ? [...old, String(s.id)]
                        : old.filter((v) => v !== String(s.id)),
                    )
                  }
                />
                {titleOf(s)}
              </label>
            ))
          ) : (
            <>
              {values.map((v, i) => (
                <div className="operations-actions" key={i}>
                  <label>
                    Tên thiết bị / điều kiện
                    <input
                      required
                      value={v.key}
                      onChange={(e) =>
                        setValues((old) =>
                          old.map((row, j) =>
                            j === i ? { ...row, key: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Số lượng
                    <input
                      required
                      type="number"
                      min={0}
                      step={1}
                      value={v.quantity}
                      onChange={(e) =>
                        setValues((old) =>
                          old.map((row, j) =>
                            j === i
                              ? { ...row, quantity: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      setValues((old) => old.filter((_, j) => j !== i))
                    }
                  >
                    Bỏ
                  </button>
                </div>
              ))}
              <button
                className="button"
                type="button"
                onClick={() =>
                  setValues((old) => [...old, { key: "", quantity: 1 }])
                }
              >
                Thêm điều kiện
              </button>
            </>
          )}
          {manager && (
            <button className="button primary" disabled={!id || !loaded}>
              Lưu cấu hình
            </button>
          )}
          <p>
            Yêu cầu của lớp đã tạo được giữ nguyên khi điều kiện bộ môn thay
            đổi.
          </p>
        </fieldset>
        {error != null && <ErrorState error={error} />}
      </form>
    </section>
  );
}
