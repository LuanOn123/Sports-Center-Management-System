import { StatusBadge } from "../../shared/StatusBadge";
import { ClassForm } from "./ClassForm";
import { ScheduleForm } from "./ScheduleForm";
import { CoachAssignmentForm } from "./CoachAssignmentForm";
import { ClassRegistrations, MemberProfile } from "./UserCourseDetails";
import { ResourceCollection } from "../../shared/ResourceCollection";
import { CoachFeedback } from "../../shared/CoachFeedback";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  List,
  ArrowLeft,
  ArrowRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  UsersRound,
  Repeat2,
} from "lucide-react";
import { api, contract } from "../../shared/api";
import { canCompleteSchedule } from "../../shared/businessRules";
import { Attendance } from "../../shared/Attendance";
import { Waitlist } from "../../shared/Waitlist";
import { allPages } from "../../shared/pagedApi";
import type { RecordData } from "../../shared/api";
import type { Resource } from "./config";
import {
  ScheduleCalendar,
  calendarRange,
  type ScheduleCalendarView,
} from "./ScheduleCalendar";
import { at, display, label, money } from "../../shared/config";
import { classSports } from "../../shared/sports";
import { useDebouncedValue } from "../../shared/useDebouncedValue";
import {
  Details,
  Empty,
  ErrorState,
  FilterField,
  Loading,
  Modal,
  SchemaForm,
} from "../../shared/ui";
export function ResourcePage({
  resource: r,
  role = "MANAGER",
  userId,
}: {
  resource: Resource;
  role?: string;
  userId?: string;
}) {
  const client = useQueryClient();
  const cardView = [
    "rooms",
    "sports",
    "classes",
    "coaches",
    "staff",
    "membership-plans",
  ].includes(r.slug);
  const [view, setView] = useState<"visual" | "table">(
    cardView || r.slug === "schedules" ? "visual" : "table",
  );
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState<Record<string, string>>(
    (): Record<string, string> =>
      r.slug === "users" && searchParams.get("role") === "MEMBER"
        ? { role: "MEMBER" }
        : {},
  );
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(query.search);
  const [modal, setModal] = useState<{ kind: string; row?: RecordData } | null>(
    null,
  );
  const [detailTab, setDetailTab] = useState("overview");
  const [bError, setBError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [calendarView, setCalendarView] =
    useState<ScheduleCalendarView>("week");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const listKey = "GET " + r.path;
  const params = contract[listKey].parameters.filter((p) => p.in === "query");
  const paginated = params.some((p) => p.name === "page");
  const filters = params.filter((p) => {
    if (["page", "limit"].includes(p.name) || (p.name === "role" && r.role))
      return false;
    if (
      r.slug === "schedules" &&
      [
        "date",
        "startAfter",
        "startBefore",
        "from",
        "to",
        "weekday",
        "weekdays",
      ].includes(p.name)
    )
      return false;
    return true;
  });
  const visibleCalendarRange = calendarRange(calendarCursor, calendarView);
  const requestQuery = {
    ...query,
    ...(query.search !== undefined ? { search } : {}),
    ...(r.slug === "staff" ? { role: "RECEPTIONIST" } : {}),
    ...(r.slug === "schedules"
      ? {
          from: visibleCalendarRange.start.toISOString(),
          to: visibleCalendarRange.end.toISOString(),
        }
      : paginated
        ? { page: String(page), limit: "10" }
        : {}),
  };
  const q = useQuery({
    queryKey: ["resource", r.slug, requestQuery],
    queryFn: ({ signal }) =>
      r.slug === "schedules"
        ? allPages<RecordData>(listKey, { query: requestQuery, signal })
        : api<RecordData[]>(listKey, { query: requestQuery, signal }),
  });
  const underCapacityQuery = useQuery({
    queryKey: ["schedules", "under-capacity", 48],
    queryFn: () =>
      api<any>("GET /class-schedules/under-capacity", {
        query: { hoursAhead: "48" },
      }),
    enabled: r.slug === "schedules" && role === "MANAGER",
    refetchInterval: 60000,
  });
  const underCapacitySchedules: any[] = useMemo(() => {
    return underCapacityQuery.data?.data?.schedules ?? [];
  }, [underCapacityQuery.data]);
  const underCapacityMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of underCapacitySchedules) {
      map.set(String(s.id), s);
    }
    return map;
  }, [underCapacitySchedules]);
  const readOnly =
    (["ADMIN", "RECEPTIONIST"].includes(role) && r.slug === "schedules") ||
    (role !== "ADMIN" &&
      ["users", "staff", "membership-plans", "sports"].includes(r.slug)) ||
    (role === "RECEPTIONIST" && ["coaches", "rooms"].includes(r.slug));
  const create =
    r.slug === "members" && role === "MANAGER"
      ? "POST /auth/register"
      : readOnly || (role !== "ADMIN" && !!r.create)
        ? ""
        : "POST " + (r.create || r.path);
  const update = readOnly ? "" : "PATCH " + r.path + "/{id}";
  const remove = readOnly ? "" : "DELETE " + r.path + "/{id}";
  const detailKey = "GET " + r.path + "/{id}";
  const detail = useQuery({
    queryKey: ["detail", r.path, modal?.row?.id],
    queryFn: ({ signal }) =>
      api(detailKey, { params: { id: String(modal!.row!.id) }, signal }),
    enabled: Boolean(modal?.kind === "detail" && modal.row?.id),
  });
  function done() {
    setModal(null);
    void client.invalidateQueries();
  }
  async function deactivate() {
    setBusy(true);
    setBError(undefined);
    try {
      if (modal?.kind === "complete")
        await api("PATCH /class-schedules/{id}/complete", {
          params: { id: String(modal.row!.id) },
        });
      else if (r.slug === "schedules")
        await api("PATCH /class-schedules/{id}", {
          params: { id: String(modal!.row!.id) },
          body: {
            status: "CANCELLED",
            ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}),
          },
        });
      else await api(remove, { params: { id: String(modal!.row!.id) } });
      done();
    } catch (e) {
      setBError(e);
    } finally {
      setBusy(false);
    }
  }
  const rowActions = (row: RecordData) => (
    <div className="row-actions">
      <button
        title="Xem chi tiết"
        aria-label="Xem chi tiết"
        className="icon-button"
        onClick={() => {
          setDetailTab("overview");
          setModal({ kind: "detail", row });
        }}
      >
        <Eye size={17} />
      </button>
      {contract[update]?.body && (
        <button
          disabled={r.slug === "schedules" && row.status !== "SCHEDULED"}
          aria-label="Chỉnh sửa"
          title="Chỉnh sửa"
          className="icon-button"
          onClick={() => setModal({ kind: "edit", row })}
        >
          <Pencil size={16} />
        </button>
      )}
      {r.slug === "classes" && role === "MANAGER" && !readOnly && (
        <button
          aria-label="Phân công huấn luyện viên"
          title="Phân công huấn luyện viên"
          className="icon-button"
          onClick={() => setModal({ kind: "assign", row })}
        >
          <UserPlus size={17} />
        </button>
      )}
      {r.slug === "classes" && role === "MANAGER" && !readOnly && (
        <button
          aria-label="Phân công huấn luyện viên hỗ trợ"
          title="Phân công huấn luyện viên hỗ trợ"
          className="icon-button"
          onClick={() => setModal({ kind: "assignSupport", row })}
        >
          <UsersRound size={17} />
        </button>
      )}
      {r.slug === "schedules" &&
        !readOnly &&
        ["MANAGER", "RECEPTIONIST"].includes(role) && (
          <button
            className="button small"
            disabled={!canCompleteSchedule(row)}
            onClick={() => {
              setBError(undefined);
              setModal({ kind: "complete", row });
            }}
          >
            Hoàn tất
          </button>
        )}
      {r.slug === "rooms" && row.isActive !== false && (
        <button
          aria-label="Chuyển lịch sang phòng khác"
          title="Chuyển lịch sang phòng khác"
          className="icon-button"
          onClick={() => setModal({ kind: "transferRoom", row })}
        >
          <Repeat2 size={17} />
        </button>
      )}
      {r.slug === "schedules" &&
        role === "MANAGER" &&
        underCapacityMap.has(String(row.id)) &&
        row.status === "SCHEDULED" && (
          <button
            aria-label="Hủy buổi do không đủ sĩ số"
            title="Hủy buổi do không đủ sĩ số"
            className="button small danger"
            style={{
              fontSize: "0.75rem",
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
            onClick={() => {
              const uc = underCapacityMap.get(String(row.id));
              setBError(undefined);
              setCancelReason(
                `Lớp không đạt sĩ số tối thiểu (hiện có ${uc.bookedCount}/${uc.minCapacity} học viên)`,
              );
              setModal({ kind: "delete", row });
            }}
          >
            Hủy (thiếu sĩ số)
          </button>
        )}
      {contract[remove] && (
        <button
          aria-label={r.slug === "schedules" ? "Hủy lịch" : "Ngừng hoạt động"}
          title={r.slug === "schedules" ? "Hủy lịch" : "Ngừng hoạt động"}
          className="icon-button danger-text"
          disabled={
            row.isActive === false ||
            row.status === "CANCELLED" ||
            row.status === "COMPLETED" ||
            (r.path === "/users" && row.id === userId)
          }
          onClick={() => {
            setBError(undefined);
            setCancelReason("");
            setModal({ kind: "delete", row });
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KHÔNG GIAN QUẢN LÝ</div>
          <h1>{r.title}</h1>
          <p>{r.subtitle}</p>
        </div>
        {contract[create]?.body && (
          <button
            className="button primary"
            onClick={() => setModal({ kind: "create" })}
          >
            <Plus size={18} />
            Thêm {r.title.toLowerCase()}
          </button>
        )}
      </div>
      {r.slug === "membership-plans" && (
        <p className="field-note">
          Gói miễn phí được tự động cấp cho hội viên. Danh sách này chỉ quản lý
          các gói trả phí.
        </p>
      )}
      {r.slug === "schedules" &&
        role === "MANAGER" &&
        underCapacitySchedules.length > 0 && (
          <div
            className="panel under-capacity-notice"
            style={{
              backgroundColor: "var(--member-warning-soft)",
              border: "1px solid var(--member-warning-border)",
              marginBottom: "16px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--member-warning)",
                  fontSize: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                ⚠️ Buổi học trong 48 giờ tới chưa đủ sĩ số tối thiểu (
                {underCapacitySchedules.length} buổi)
              </h3>
              <span
                style={{ fontSize: "0.85rem", color: "var(--member-warning)" }}
              >
                Theo dõi sĩ số trước giờ học
              </span>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {underCapacitySchedules.map((s: any) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--member-surface)",
                    color: "var(--member-text)",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--member-border)",
                  }}
                >
                  <div>
                    <strong>{s.className}</strong> · Phòng {s.roomName} ·{" "}
                    <span>
                      {new Date(s.startTime).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    {" — "}
                    <span
                      style={{
                        color: "var(--member-warning)",
                        fontWeight: 600,
                      }}
                    >
                      Chưa đủ sĩ số ({s.bookedCount}/{s.minCapacity} học viên ·
                      Thiếu {s.shortfall})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button small danger"
                    onClick={() => {
                      setBError(undefined);
                      setCancelReason(
                        `Lớp không đạt sĩ số tối thiểu (hiện có ${s.bookedCount}/${s.minCapacity} học viên)`,
                      );
                      setModal({ kind: "delete", row: s });
                    }}
                  >
                    Hủy buổi do không đủ sĩ số
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {r.slug === "schedules"
                ? "Lịch học tại trung tâm"
                : `Danh sách ${r.title.toLowerCase()}`}
            </h2>
            <p>
              {r.slug === "schedules"
                ? `${q.data?.data.length || 0} buổi trong khoảng đang xem`
                : q.data?.pagination
                  ? `${q.data.pagination.total} kết quả`
                  : "Dữ liệu trung tâm"}
            </p>
          </div>
          <button
            aria-label="Tải lại dữ liệu"
            className="icon-button"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw size={18} className={q.isFetching ? "spin" : ""} />
          </button>
        </div>
        {(cardView || r.slug === "schedules") && (
          <div className="collection-toolbar">
            <p>
              {r.slug === "schedules"
                ? "Thời gian, phòng tập và trạng thái từng buổi học."
                : "Xem nhanh thông tin hoặc chuyển sang bảng để đối chiếu."}
            </p>
            <div
              className="view-switch"
              role="group"
              aria-label="Kiểu hiển thị"
            >
              <button
                aria-pressed={view === "visual"}
                onClick={() => setView("visual")}
              >
                <LayoutGrid size={16} />
                {r.slug === "schedules" ? "Lịch" : "Thẻ"}
              </button>
              <button
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
              >
                <List size={16} />
                Bảng
              </button>
            </div>
          </div>
        )}
        <div className="filters">
          {filters.map((p) => (
            <FilterField
              key={p.name}
              name={p.name}
              schema={p.schema}
              value={query[p.name] || ""}
              onChange={(v) => {
                setQuery((prev) => ({ ...prev, [p.name]: v }));
                setPage(1);
              }}
            />
          ))}
          {Object.values(query).some(Boolean) && (
            <button
              className="button small"
              type="button"
              onClick={() => {
                setQuery({});
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data.data.length && r.slug !== "schedules" ? (
          <Empty
            text="Không tìm thấy kết quả"
            detail="Thử thay đổi bộ lọc hoặc thêm dữ liệu mới."
          />
        ) : view === "visual" && cardView ? (
          <ResourceCollection
            rows={q.data.data}
            columns={r.columns}
            kind={r.slug}
            actions={rowActions}
          />
        ) : view === "visual" && r.slug === "schedules" ? (
          <ScheduleCalendar
            rows={q.data.data}
            cursor={calendarCursor}
            view={calendarView}
            onCursorChange={setCalendarCursor}
            onViewChange={setCalendarView}
            underCapacityMap={underCapacityMap}
            onSelect={(row) => {
              setDetailTab("overview");
              setModal({ kind: "detail", row });
            }}
          />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={`Danh sách ${r.title.toLowerCase()}, có thể cuộn ngang`}
          >
            <table>
              <thead>
                <tr>
                  {r.columns.map(([k, title]) => (
                    <th key={k} scope="col">
                      {title}
                    </th>
                  ))}
                  <th className="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((row) => (
                  <tr key={String(row.id)}>
                    {r.columns.map(([k], i) => (
                      <td key={k}>
                        {i === 0 ? (
                          <div className="name-cell">
                            <span
                              className={
                                "avatar color-" +
                                (String(row.id).charCodeAt(0) % 4)
                              }
                            >
                              {String(at(row, k) || "?")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div>
                              <strong>{display(at(row, k))}</strong>
                              {r.slug === "schedules" &&
                                underCapacityMap.has(String(row.id)) && (
                                  <div>
                                    <span
                                      className="badge warning"
                                      style={{
                                        backgroundColor: "#fef3c7",
                                        color: "var(--member-warning)",
                                        fontSize: "0.72rem",
                                        padding: "1px 5px",
                                        borderRadius: "4px",
                                        fontWeight: 600,
                                        display: "inline-block",
                                        marginTop: "2px",
                                      }}
                                    >
                                      ⚠️ Chưa đủ sĩ số (
                                      {
                                        underCapacityMap.get(String(row.id))
                                          .bookedCount
                                      }
                                      /
                                      {
                                        underCapacityMap.get(String(row.id))
                                          .minCapacity
                                      }{" "}
                                      học viên)
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        ) : [
                            "isActive",
                            "status",
                            "tier",
                            "classType",
                            "role",
                            "trainingLevel",
                          ].includes(k) ? (
                          <StatusBadge value={at(row, k)} />
                        ) : k === "price" ? (
                          money(at(row, k))
                        ) : (
                          display(at(row, k))
                        )}
                      </td>
                    ))}
                    <td>{rowActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data?.pagination && (
          <div className="pagination">
            <span>
              Trang {q.data.pagination.page} /{" "}
              {Math.max(1, q.data.pagination.totalPages)} ·{" "}
              {q.data.pagination.total} kết quả
            </span>
            {paginated && (
              <div>
                <button
                  className="button small"
                  disabled={page <= 1 || q.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ArrowLeft size={15} />
                  Trước
                </button>
                <button
                  className="button small"
                  disabled={
                    page >= q.data.pagination.totalPages || q.isFetching
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      {!paginated && q.data?.pagination && q.data.pagination.totalPages > 1 && (
        <p className="footnote">
          Máy chủ còn dữ liệu ở trang khác nhưng chưa công bố tham số phân trang
          cho danh sách này.
        </p>
      )}
      {["users", "members", "staff", "membership-plans"].includes(r.slug) &&
        !contract[update]?.body && (
          <p className="footnote">
            Chỉnh sửa {r.title.toLowerCase()} hiện chưa khả dụng. Bạn vẫn có thể
            xem chi tiết trong danh sách.
          </p>
        )}
      {modal && (
        <Modal
          dismissible={!busy}
          title={
            modal.kind === "complete"
              ? "Hoàn tất buổi học"
              : modal.kind === "create"
                ? "Thêm " + r.title.toLowerCase()
                : modal.kind === "assign"
                  ? "Phân công huấn luyện viên"
                  : modal.kind === "assignSupport"
                    ? "Phân công huấn luyện viên hỗ trợ"
                    : modal.kind === "transferRoom"
                      ? "Chuyển lịch sang phòng khác"
                      : modal.kind === "edit"
                        ? "Chỉnh sửa thông tin"
                        : modal.kind === "delete"
                          ? r.slug === "schedules"
                            ? "Hủy lịch hoạt động"
                            : "Ngừng hoạt động"
                          : "Chi tiết " + r.title.toLowerCase()
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {r.slug === "classes" && ["create", "edit"].includes(modal.kind) ? (
            <ClassForm
              initial={modal.kind === "edit" ? modal.row : {}}
              onSuccess={done}
              onCancel={() => setModal(null)}
              onBusyChange={setBusy}
            />
          ) : r.slug === "schedules" &&
            ["create", "edit"].includes(modal.kind) ? (
            <ScheduleForm
              initial={modal.kind === "edit" ? modal.row : {}}
              mode={modal.kind as "create" | "edit"}
              onSuccess={done}
              onCancel={() => setModal(null)}
              onBusyChange={setBusy}
            />
          ) : modal.kind === "transferRoom" ? (
            <RoomScheduleTransfer
              source={modal.row!}
              onDone={done}
              onCancel={() => setModal(null)}
              onBusyChange={setBusy}
            />
          ) : ["assign", "assignSupport"].includes(modal.kind) ? (
            <CoachAssignmentForm
              classId={String(modal.row?.id)}
              support={modal.kind === "assignSupport"}
              onSuccess={done}
              onCancel={() => setModal(null)}
              onBusyChange={setBusy}
            />
          ) : ["create", "edit"].includes(modal.kind) ? (
            <SchemaForm
              operation={modal.kind === "create" ? create : update}
              params={{ id: String(modal.row?.id) }}
              initial={
                modal.kind === "edit"
                  ? r.slug === "coaches"
                    ? {
                        ...modal.row,
                        ...(modal.row?.coachProfile as RecordData),
                      }
                    : r.slug === "members"
                      ? { ...modal.row, ...(modal.row?.user as RecordData) }
                      : modal.row
                  : {}
              }
              fixed={
                modal.kind === "create" && r.role
                  ? { role: r.role }
                  : modal.kind === "edit" &&
                      r.path === "/users" &&
                      modal.row?.id === userId
                    ? { role: modal.row?.role, isActive: true }
                    : {}
              }
              onSuccess={done}
              onBusyChange={setBusy}
              onCancel={() => setModal(null)}
            />
          ) : ["delete", "complete"].includes(modal.kind) ? (
            <>
              <p className="confirm-copy">
                {modal.kind === "complete"
                  ? "Chỉ hoàn tất khi buổi học đã kết thúc. Các đăng ký BOOKED sẽ chuyển thành COMPLETED; kết quả điểm danh được lưu riêng."
                  : r.slug === "schedules"
                    ? "Hủy lịch này sẽ tự động hủy tất cả lượt đăng ký BOOKED."
                    : "Bản ghi sẽ được ngừng hoạt động và được lưu lại trong hệ thống."}{" "}
                Bạn có muốn tiếp tục?
              </p>
              {r.slug === "schedules" && modal.kind === "delete" && (
                <label>
                  Lý do hủy lịch (tối đa 500 ký tự)
                  <textarea
                    maxLength={500}
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    placeholder="Ví dụ: Huấn luyện viên nghỉ đột xuất"
                  />
                </label>
              )}
              {bError != null && <ErrorState error={bError} />}
              <div className="modal-footer">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Quay lại
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={deactivate}
                >
                  {busy ? "Đang xử lý…" : "Xác nhận"}
                </button>
              </div>
            </>
          ) : detail.isPending ? (
            <Loading variant="details" />
          ) : detail.isError ? (
            <ErrorState error={detail.error} retry={() => detail.refetch()} />
          ) : (
            <>
              {(["members", "schedules", "classes", "coaches"].includes(
                r.slug,
              ) ||
                (r.slug === "users" && modal.row?.role === "MEMBER")) && (
                <div
                  className="detail-tabs"
                  role="group"
                  aria-label="Nội dung chi tiết"
                >
                  <button
                    className="button small"
                    aria-pressed={detailTab === "overview"}
                    onClick={() => setDetailTab("overview")}
                  >
                    Tổng quan
                  </button>
                  <button
                    className="button small"
                    aria-pressed={detailTab === "related"}
                    onClick={() => setDetailTab("related")}
                  >
                    {r.slug === "members" || r.slug === "users"
                      ? "Gói & tập luyện"
                      : r.slug === "schedules"
                        ? ["RECEPTIONIST", "STAFF"].includes(role)
                          ? "Học viên"
                          : "Học viên & điểm danh"
                        : r.slug === "coaches"
                          ? "Đánh giá"
                          : role !== "MANAGER"
                            ? "Khóa học & đăng ký"
                            : "Phân công HLV"}
                  </button>
                </div>
              )}
              {detailTab === "overview" &&
                (r.slug === "rooms" ? (
                  <RoomDetailView data={detail.data.data} />
                ) : r.slug === "schedules" ? (
                  <ScheduleDetailView data={detail.data.data} />
                ) : (
                  <Details value={detail.data.data} />
                ))}
              {detailTab === "overview" &&
                r.slug === "schedules" &&
                !readOnly && (
                  <div className="modal-footer schedule-detail-actions">
                    <button
                      className="button"
                      disabled={modal.row?.status !== "SCHEDULED"}
                      onClick={() => setModal({ kind: "edit", row: modal.row })}
                    >
                      <Pencil size={16} /> Chỉnh sửa
                    </button>
                    <button
                      className="button"
                      disabled={!canCompleteSchedule(modal.row || {})}
                      onClick={() => {
                        setBError(undefined);
                        setModal({ kind: "complete", row: modal.row });
                      }}
                    >
                      Hoàn tất
                    </button>
                    <button
                      className="button danger"
                      disabled={modal.row?.status !== "SCHEDULED"}
                      onClick={() => {
                        setBError(undefined);
                        setCancelReason("");
                        setModal({ kind: "delete", row: modal.row });
                      }}
                    >
                      <Trash2 size={16} /> Hủy lịch
                    </button>
                  </div>
                )}
              {detailTab === "related" &&
                r.slug === "coaches" &&
                Boolean(at(detail.data.data, "coachProfile.id")) && (
                  <div className="workflow-card">
                    <CoachFeedback
                      coachId={String(at(detail.data.data, "coachProfile.id"))}
                      role={role}
                    />
                  </div>
                )}
              {detailTab === "related" && r.slug === "members" && (
                <>
                  <MemberStatus id={String(modal.row?.id)} />
                </>
              )}
              {detailTab === "related" &&
                r.slug === "users" &&
                modal.row?.role === "MEMBER" && (
                  <>
                    <MemberProfile id={String(modal.row.id)} />
                    <MemberStatus id={String(modal.row.id)} />
                  </>
                )}
              {detailTab === "related" && r.slug === "schedules" && (
                <Enrollments
                  id={String(modal.row?.id)}
                  schedule={detail.data.data}
                  role={role === "ADMIN" ? "VIEWER" : role}
                />
              )}
              {detailTab === "related" &&
                r.slug === "classes" &&
                role !== "MANAGER" && (
                  <ClassRegistrations id={String(modal.row?.id)} />
                )}
              {detailTab === "related" &&
                r.slug === "classes" &&
                role === "MANAGER" && (
                  <CoachAssignments
                    id={String(modal.row?.id)}
                    data={detail.data.data}
                    onUpdate={() => {
                      void detail.refetch();
                      void client.invalidateQueries({ queryKey: ["resource"] });
                    }}
                  />
                )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function RoomScheduleTransfer({
  source,
  onDone,
  onCancel,
  onBusyChange,
}: {
  source: RecordData;
  onDone: () => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [targetRoomId, setTargetRoomId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RecordData>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const rooms = useQuery({
    queryKey: ["transfer-target-rooms", source.id],
    queryFn: ({ signal }) =>
      allPages<RecordData>("GET /rooms", {
        query: { isActive: "true" },
        signal,
      }),
  });
  const body = () => ({
    targetRoomId,
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(to).toISOString() } : {}),
    ...(reason.trim() ? { reason: reason.trim() } : {}),
  });
  async function run(commit: boolean) {
    setBusy(true);
    onBusyChange(true);
    setError(undefined);
    try {
      const result = await api<RecordData>(
        commit
          ? "POST /rooms/{roomId}/transfer-schedules"
          : "POST /rooms/{roomId}/transfer-schedules/preview",
        { params: { roomId: String(source.id) }, body: body() },
      );
      if (commit) onDone();
      else setPreview(result.data);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  const conflicts = Array.isArray(preview?.conflicts)
    ? (preview.conflicts as RecordData[])
    : [];
  return (
    <div>
      <p className="confirm-copy">
        Xem trước toàn bộ lịch bị ảnh hưởng. Chỉ có thể xác nhận khi tất cả lịch
        hợp lệ; máy chủ sẽ chuyển nguyên tử, không chuyển một phần.
      </p>
      {rooms.isPending ? (
        <Loading />
      ) : rooms.isError ? (
        <ErrorState error={rooms.error} retry={() => rooms.refetch()} />
      ) : (
        <fieldset className="form-grid" disabled={busy}>
          <label>
            Phòng đích <b className="required">*</b>
            <select
              value={targetRoomId}
              onChange={(event) => {
                setTargetRoomId(event.target.value);
                setPreview(undefined);
              }}
            >
              <option value="">Chọn phòng đang hoạt động</option>
              {rooms.data.data
                .filter((room) => room.id !== source.id)
                .map((room) => (
                  <option key={String(room.id)} value={String(room.id)}>
                    {display(room.name)} · {display(room.areaType)} ·{" "}
                    {display(room.capacity)} chỗ
                  </option>
                ))}
            </select>
          </label>
          <label>
            Từ thời điểm
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPreview(undefined);
              }}
            />
          </label>
          <label>
            Đến thời điểm
            <input
              type="datetime-local"
              min={from}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPreview(undefined);
              }}
            />
          </label>
          <label className="wide">
            Lý do
            <textarea
              maxLength={500}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setPreview(undefined);
              }}
              placeholder="Ví dụ: Phòng đang bảo trì"
            />
          </label>
        </fieldset>
      )}
      {preview && (
        <section className="detail-section" role="status">
          <h3>Kết quả xem trước</h3>
          <p>
            Tổng {display(preview.totalSchedules)} lịch · hợp lệ{" "}
            {display(preview.validSchedules)} · không hợp lệ{" "}
            {display(preview.invalidSchedules)}
          </p>
          {conflicts.map((conflict, index) => (
            <p className="error" key={String(conflict.scheduleId || index)}>
              {display(conflict.startTime)} · {display(conflict.reason)}
            </p>
          ))}
        </section>
      )}
      {error != null && <ErrorState error={error} />}
      <div className="modal-footer">
        <button className="button" disabled={busy} onClick={onCancel}>
          Đóng
        </button>
        <button
          className="button"
          disabled={!targetRoomId || busy || Boolean(to && from && to <= from)}
          onClick={() => void run(false)}
        >
          {busy ? "Đang kiểm tra…" : "Xem trước"}
        </button>
        <button
          className="button primary"
          disabled={busy || preview?.canTransfer !== true}
          onClick={() => void run(true)}
        >
          Xác nhận chuyển lịch
        </button>
      </div>
    </div>
  );
}
function MemberStatus({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["membership-status", id],
    queryFn: ({ signal }) =>
      api("GET /members/{id}/membership-status", { params: { id }, signal }),
  });
  return (
    <section className="detail-section">
      <h3>Tình trạng thành viên</h3>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <Details value={q.data.data} />
      )}
    </section>
  );
}
function Enrollments({
  id,
  schedule,
  role,
}: {
  id: string;
  schedule: RecordData;
  role: string;
}) {
  const q = useQuery({
    queryKey: ["enrollments", id],
    queryFn: ({ signal }) =>
      allPages<RecordData>("GET /enrollments/schedule/{scheduleId}", {
        params: { scheduleId: id },
        signal,
      }),
  });
  return (
    <section className="detail-section">
      <h3>Danh sách đăng ký</h3>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : q.data.data.length ? (
        ["RECEPTIONIST", "STAFF"].includes(role) ? (
          <div
            className="table-scroll"
            role="region"
            aria-label="Danh sách học viên đăng ký"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Hội viên</th>
                  <th scope="col">Email</th>
                  <th scope="col">Trạng thái đăng ký</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{display(at(row, "member.user.fullName"))}</td>
                    <td>{display(at(row, "member.user.email"))}</td>
                    <td>{display(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Attendance schedule={schedule} roster={q.data.data} role={role} />
        )
      ) : (
        <Empty text="Chưa có hội viên đăng ký" />
      )}
      <Waitlist scheduleId={id} />
    </section>
  );
}
function CoachAssignments({
  id,
  data,
  onUpdate,
}: {
  id: string;
  data: RecordData;
  onUpdate: () => void;
}) {
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState("");
  const [confirm, setConfirm] = useState("");
  const coaches = Array.isArray(data.coaches)
    ? (data.coaches as RecordData[])
    : [];
  async function remove(coachId: string) {
    setPending(coachId);
    try {
      await api("DELETE /classes/{id}/coaches/{coachId}", {
        params: { id, coachId },
      });
      setConfirm("");
      onUpdate();
    } catch (e) {
      setError(e);
    } finally {
      setPending("");
    }
  }
  return (
    <section className="detail-section">
      <h3>Điều chỉnh phân công</h3>
      <p className="field-note">
        Hội viên đã đặt các buổi học sắp tới sẽ nhận thông báo khi thay đổi huấn
        luyện viên.
      </p>
      {coaches.map((c, i) => {
        const coachId = String(at(c, "coach.id") || "");
        return (
          <div className="assignment" key={i}>
            <span>
              {display(at(c, "coach.user.fullName"))}{" "}
              <small className="badge">
                {c.isPrimary ? "HLV chính" : "HLV hỗ trợ"}
              </small>
            </span>
            {coachId ? (
              <button
                className="button small"
                disabled={Boolean(pending)}
                onClick={() =>
                  confirm === coachId
                    ? void remove(coachId)
                    : setConfirm(coachId)
                }
              >
                {confirm === coachId ? "Xác nhận gỡ" : "Gỡ phân công"}
              </button>
            ) : (
              <small>
                Hồ sơ chưa đầy đủ để gỡ phân công. Vui lòng kiểm tra thông tin
                huấn luyện viên.
              </small>
            )}
          </div>
        );
      })}
      {error != null && <ErrorState error={error} />}
    </section>
  );
}

export function RoomDetailView({ data }: { data: RecordData }) {
  const capabilities = Array.isArray(data.capabilities)
    ? (data.capabilities as RecordData[])
    : [];
  return (
    <div className="detail-content room-detail-view">
      <div
        className="room-detail-header"
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--member-border, #e3ebe5)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "18px" }}>
            {String(data.name || "Phòng tập")}
          </h3>
          {data.location ? (
            <small style={{ color: "var(--member-muted, #53675a)" }}>
              Vị trí: {String(data.location)}
            </small>
          ) : null}
        </div>
        <StatusBadge value={data.isActive !== false} />
      </div>
      <dl className="details">
        <div>
          <dt>Sức chứa</dt>
          <dd>
            <strong>{String(data.capacity ?? "—")}</strong> người
          </dd>
        </div>
        <div>
          <dt>Khu vực tập</dt>
          <dd>{display(data.areaType)}</dd>
        </div>
        {data.location ? (
          <div>
            <dt>Vị trí</dt>
            <dd>{String(data.location)}</dd>
          </div>
        ) : null}
      </dl>
      {data.areaType === "INDOOR" && (
        <div className="room-equipment-summary">
          <h4>Dụng cụ trong phòng</h4>
          <p>
            {capabilities.some((row) => Number(row.quantity) > 0)
              ? "Có dụng cụ"
              : "Không có dụng cụ"}
          </p>
        </div>
      )}
      {Boolean(data.createdAt || data.updatedAt) && (
        <details className="detail-disclosure detail-meta">
          <summary>Thông tin bổ sung</summary>
          <dl className="details">
            {data.createdAt ? (
              <div>
                <dt>Ngày tạo</dt>
                <dd>{display(data.createdAt)}</dd>
              </div>
            ) : null}
            {data.updatedAt ? (
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{display(data.updatedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      )}
    </div>
  );
}

export function ScheduleDetailView({ data }: { data: RecordData }) {
  const cls = (data.class || {}) as RecordData;
  const room = (data.room || {}) as RecordData;
  const coach = (data.coach || {}) as RecordData;
  const coachName =
    at(coach, "user.fullName") ||
    at(data, "coach.fullName") ||
    at(cls, "coaches.0.coach.user.fullName");
  const sports = classSports(cls);

  const snapshot = data.requirementsSnapshot;
  let snapshotEntries: [string, unknown][] = [];
  if (snapshot && typeof snapshot === "object") {
    if (Array.isArray(snapshot)) {
      snapshotEntries = snapshot.map((item, idx) => [
        String(item.key || item.name || `Yêu cầu ${idx + 1}`),
        item.quantity ?? item.minimum ?? item.value ?? item,
      ]);
    } else {
      snapshotEntries = Object.entries(snapshot);
    }
  }

  const fmtDate = (d?: unknown) =>
    d
      ? new Date(String(d)).toLocaleDateString("vi-VN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Ho_Chi_Minh",
        })
      : "—";
  const fmtTime = (d?: unknown) =>
    d
      ? new Date(String(d)).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Ho_Chi_Minh",
        })
      : "—";

  return (
    <div className="detail-content schedule-detail-view">
      <div
        className="schedule-detail-header"
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #e3ebe5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "18px" }}>
            {String(cls.name || data.title || "Buổi học")}
          </h3>
          {sports.length > 0 && (
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {sports.map((s) => (
                <span key={s.id || s.name} className="badge">
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <StatusBadge value={data.status || "SCHEDULED"} />
      </div>

      <dl className="details">
        <div>
          <dt>Ngày diễn ra</dt>
          <dd>
            <strong>{fmtDate(data.startTime)}</strong>
          </dd>
        </div>
        <div>
          <dt>Thời gian</dt>
          <dd>
            {fmtTime(data.startTime)} – {fmtTime(data.endTime)}
          </dd>
        </div>
        <div>
          <dt>Phòng tập</dt>
          <dd>
            <strong>{String(room.name || "—")}</strong>
            {room.location ? ` (${room.location})` : ""}
            {room.areaType ? ` · ${display(room.areaType)}` : ""}
          </dd>
        </div>
        <div>
          <dt>Huấn luyện viên phụ trách</dt>
          <dd>
            <strong>{String(coachName || "Chưa phân công")}</strong>
          </dd>
        </div>
        {cls.capacity ? (
          <div>
            <dt>Sức chứa lớp</dt>
            <dd>{String(cls.capacity)} học viên</dd>
          </div>
        ) : null}
        {cls.classType ? (
          <div>
            <dt>Loại lớp</dt>
            <dd>
              <StatusBadge value={cls.classType} />
            </dd>
          </div>
        ) : null}
      </dl>

      <div style={{ padding: "0 24px 16px" }}>
        <h4
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--member-text, #304e3d)",
            marginBottom: "8px",
          }}
        >
          Điều kiện tổ chức tại thời điểm tạo lịch
        </h4>
        {snapshotEntries.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "8px",
            }}
          >
            {snapshotEntries.map(([k, v], i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px",
                  background: "var(--member-surface-alt, #f8faf9)",
                  border: "1px solid var(--member-border, #e3ebe5)",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{label(k)}</span>
                <strong>{String(v ?? "—")}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="detail-empty-item" style={{ margin: 0 }}>
            <span>Không có điều kiện đặc biệt tại thời điểm tạo lịch</span>
          </div>
        )}
      </div>

      {Boolean(data.createdAt || data.updatedAt) && (
        <details className="detail-disclosure detail-meta">
          <summary>Thông tin bổ sung</summary>
          <dl className="details">
            {data.createdAt ? (
              <div>
                <dt>Ngày tạo</dt>
                <dd>{display(data.createdAt)}</dd>
              </div>
            ) : null}
            {data.updatedAt ? (
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{display(data.updatedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      )}
    </div>
  );
}
