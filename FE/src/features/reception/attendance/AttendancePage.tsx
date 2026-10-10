import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../../shared/api";
import { allPages } from "../../../shared/pagedApi";
import { getFacilityId } from "../../../shared/facility";
import { display } from "../../../shared/config";
import { useDebouncedValue } from "../../../shared/useDebouncedValue";
import { Empty, ErrorState, Loading, Modal } from "../../../shared/ui";
import { Heading } from "../components";
import "./attendance.css";

type AttendanceStatus = "NORMAL" | "WARNING" | "VIOLATION";
type AttendanceRow = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  classId: string;
  className: string;
  attendedCount: number;
  absentCount: number;
  excusedCount: number;
  unrecordedCount: number;
  upcomingCount: number;
  totalRelevantClassSessions: number;
  absenceRate: number;
  status: AttendanceStatus;
  warningSent: boolean;
  reportStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
};
type AttendanceDetail = {
  member: {
    fullName: string;
    email: string;
    subscription: {
      planName: string;
      startDate: string;
      endDate: string;
    } | null;
  };
  class: { name: string };
  summary: AttendanceRow;
  sessions: {
    enrollmentId: string;
    enrollmentStatus: string;
    scheduleId: string;
    startTime: string;
    endTime: string;
    roomName: string;
    state: string;
    note: string | null;
  }[];
  warnings: { id: string; title: string; body: string; createdAt: string }[];
  reports: {
    id: string;
    status: string;
    response: string | null;
    createdAt: string;
  }[];
};
const labels: Record<string, string> = {
  NORMAL: "Bình thường",
  WARNING: "Cảnh báo",
  VIOLATION: "Vi phạm",
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  ABSENT: "Vắng",
  EXCUSED: "Vắng có phép",
  UPCOMING: "Sắp diễn ra",
  NOT_RECORDED: "Chưa ghi nhận",
  PENDING: "Chờ quản lý duyệt",
  APPROVED: "Đã duyệt hủy đăng ký",
  REJECTED: "Giữ hội viên",
  OPEN: "Chờ duyệt",
  IN_PROGRESS: "Đang xem xét",
  RESOLVED: "Đã duyệt hủy đăng ký",
  CLOSED: "Giữ hội viên",
};
const percent = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
function Status({ value }: { value: AttendanceStatus }) {
  return (
    <span className={`attendance-status attendance-${value.toLowerCase()}`}>
      {labels[value]}
    </span>
  );
}

export function AttendancePage() {
  return (
    <>
      <Heading title="Chuyên cần" />
      <AttendanceCollection />
    </>
  );
}

export function MemberAttendanceModal({
  member,
  onClose,
}: {
  member: RecordData;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Xem điểm danh hội viên"
      onClose={onClose}
      dismissible={!busy}
      maxWidth={1100}
    >
      <AttendanceCollection
        memberId={String(member.id)}
        onBusyChange={setBusy}
      />
    </Modal>
  );
}

function AttendanceCollection({
  memberId,
  onBusyChange,
}: {
  memberId?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const facilityId = getFacilityId();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AttendanceRow>();
  const [action, setAction] = useState<{
    row: AttendanceRow;
    type: "warning" | "report";
  }>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const list = useQuery({
    queryKey: [
      "reception-attendance",
      facilityId,
      memberId,
      debouncedSearch,
      status,
      classId,
      page,
    ],
    queryFn: ({ signal }) =>
      api<AttendanceRow[]>("GET /attendance/monitoring", {
        query: {
          ...(memberId ? { memberId } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(status ? { status } : {}),
          ...(classId ? { classId } : {}),
          page: String(page),
          limit: "20",
        },
        signal,
      }),
  });
  const classes = useQuery({
    queryKey: ["reception-attendance-classes", facilityId, memberId],
    queryFn: ({ signal }) =>
      allPages<{ id: string; name: string }>("GET /classes", { signal }),
  });
  const classOptions = [
    ...new Map(
      (classes.data?.data || []).map((row) => [row.id, row.name]),
    ).entries(),
  ];
  const openAction = (row: AttendanceRow, type: "warning" | "report") => {
    setAction({ row, type });
    setReason("");
    setError(undefined);
    setSuccess("");
  };
  return (
    <div className="reception-attendance">
      <p className="field-note">
        Có mặt và đi muộn được tính là đã tham gia. Vắng có phép được hiển thị
        riêng. Từ 20% vắng: cảnh báo; từ 30%: báo cáo quản lý xem xét.
      </p>
      <p className="field-note">
        Tỷ lệ vắng = số buổi vắng / tổng buổi đăng ký đủ điều kiện, gồm buổi sắp
        diễn ra và chưa ghi nhận; loại buổi hủy và vắng có phép. Chưa ghi nhận
        không được tính là vắng. Lịch sử lớp đã học được giữ để đối chiếu.
      </p>
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
      {selected ? (
        <>
          <button className="button" onClick={() => setSelected(undefined)}>
            Quay lại danh sách lớp
          </button>
          <AttendanceDetailPanel row={selected} />
        </>
      ) : (
        <>
          <div className="panel attendance-filters">
            {!memberId && (
              <label>
                Tìm hội viên
                <input
                  type="search"
                  placeholder="Tên, email hoặc điện thoại"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            )}
            <label>
              Lớp học
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả lớp học</option>
                {classOptions.map(([id, name]) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái chuyên cần
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                {["NORMAL", "WARNING", "VIOLATION"].map((value) => (
                  <option value={value} key={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {list.isPending ? (
            <Loading />
          ) : list.error ? (
            <ErrorState error={list.error} retry={() => list.refetch()} />
          ) : !list.data.data.length ? (
            <Empty
              text={
                search || status || classId
                  ? "Không có kết quả phù hợp với bộ lọc."
                  : "Chưa có đăng ký lớp tại cơ sở này."
              }
            />
          ) : (
            <>
              <div
                className="table-scroll"
                role="region"
                aria-label="Chuyên cần theo hội viên và lớp, có thể cuộn ngang"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Số buổi tham gia và vắng của hội viên tại từng lớp
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Hội viên",
                        "Lớp học",
                        "Đã tham gia",
                        "Vắng",
                        "Tỷ lệ vắng",
                        "Trạng thái",
                        "Thao tác",
                      ].map((text) => (
                        <th scope="col" key={text}>
                          {text}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((row) => (
                      <tr key={`${row.memberId}:${row.classId}`}>
                        <th scope="row">
                          <strong>{row.memberName}</strong>
                          <small>{row.memberEmail}</small>
                        </th>
                        <td>
                          {row.className}
                          <small>
                            {row.reportStatus === "APPROVED"
                              ? "Đã hủy đăng ký theo quyết định quản lý"
                              : row.upcomingCount > 0
                                ? `Còn ${row.upcomingCount} buổi sắp diễn ra`
                                : "Lịch sử lớp đã đăng ký"}
                          </small>
                          <small>
                            {row.totalRelevantClassSessions} buổi được tính
                          </small>
                        </td>
                        <td>{row.attendedCount} buổi</td>
                        <td>
                          {row.absentCount} buổi
                          {row.excusedCount > 0 && (
                            <small>{row.excusedCount} vắng có phép</small>
                          )}
                        </td>
                        <td>{percent(row.absenceRate)}</td>
                        <td>
                          <Status value={row.status} />
                          {row.reportStatus && (
                            <small>{labels[row.reportStatus]}</small>
                          )}
                        </td>
                        <td>
                          <div className="reception-actions">
                            <button
                              className="button small"
                              disabled={busy}
                              onClick={() => {
                                setSelected(row);
                                setAction(undefined);
                              }}
                            >
                              Xem chi tiết
                            </button>
                            {row.status !== "NORMAL" && (
                              <button
                                className="button small"
                                disabled={row.warningSent || busy}
                                onClick={() => openAction(row, "warning")}
                              >
                                {row.warningSent
                                  ? "Đã gửi cảnh báo"
                                  : "Gửi cảnh báo"}
                              </button>
                            )}
                            {row.status === "VIOLATION" && (
                              <button
                                className="button small"
                                disabled={
                                  row.reportStatus === "PENDING" ||
                                  row.reportStatus === "APPROVED" ||
                                  busy
                                }
                                onClick={() => openAction(row, "report")}
                              >
                                {row.reportStatus === "PENDING"
                                  ? "Đang chờ duyệt"
                                  : "Báo cáo quản lý"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button
                  className="button"
                  disabled={page <= 1 || list.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Trang trước
                </button>
                <span aria-live="polite">
                  Trang {page} /{" "}
                  {Math.max(1, list.data.pagination?.totalPages || 1)} ·{" "}
                  {list.data.pagination?.total || 0} kết quả
                </span>
                <button
                  className="button"
                  disabled={
                    list.isFetching ||
                    page >= (list.data.pagination?.totalPages || 1)
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Trang sau
                </button>
              </div>
            </>
          )}
        </>
      )}
      {action && (
        <form
          className="panel attendance-action"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            onBusyChange?.(true);
            setError(undefined);
            try {
              const result = await api<{ message: string }>(
                action.type === "warning"
                  ? "POST /attendance/warnings/send"
                  : "POST /attendance/reports",
                {
                  body: {
                    memberId: action.row.memberId,
                    classId: action.row.classId,
                    ...(action.type === "report" ? { reason } : {}),
                  },
                },
              );
              setSuccess(result.data.message);
              setAction(undefined);
              await cache.invalidateQueries({
                queryKey: ["reception-attendance"],
              });
              await cache.invalidateQueries({
                queryKey: ["reception-attendance-detail"],
              });
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
              onBusyChange?.(false);
            }
          }}
        >
          <h3>
            {action.type === "warning"
              ? "Xác nhận gửi cảnh báo"
              : "Báo cáo vi phạm chuyên cần"}
          </h3>
          <p>
            {action.row.memberName} · {action.row.className}: vắng{" "}
            {action.row.absentCount}/{action.row.totalRelevantClassSessions}{" "}
            buổi ({percent(action.row.absenceRate)}).
          </p>
          <p>
            {action.type === "warning"
              ? "Hội viên sẽ nhận thông báo cảnh báo cho lớp này."
              : "Quản lý cơ sở sẽ xem xét. Hội viên tiếp tục giữ đăng ký cho đến khi có quyết định."}
          </p>
          {action.type === "report" && (
            <label>
              Lý do báo cáo
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {error != null && <ErrorState error={error} />}
          <div className="reception-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setAction(undefined)}
            >
              Hủy
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Đang gửi…" : "Xác nhận gửi"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AttendanceDetailPanel({ row }: { row: AttendanceRow }) {
  const detail = useQuery({
    queryKey: [
      "reception-attendance-detail",
      getFacilityId(),
      row.memberId,
      row.classId,
    ],
    queryFn: ({ signal }) =>
      api<AttendanceDetail>("GET /attendance/monitoring/detail", {
        query: { memberId: row.memberId, classId: row.classId },
        signal,
      }),
  });
  if (detail.isPending) return <Loading variant="details" />;
  if (detail.error)
    return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  const data = detail.data.data;
  return (
    <section className="panel attendance-detail">
      <h2>
        {data.member.fullName} · {data.class.name}
      </h2>
      <p>{data.member.email}</p>
      <Status value={data.summary.status} />
      <dl className="attendance-summary">
        {[
          ["Đã tham gia", data.summary.attendedCount],
          ["Vắng", data.summary.absentCount],
          ["Vắng có phép", data.summary.excusedCount],
          ["Chưa ghi nhận", data.summary.unrecordedCount],
          ["Sắp diễn ra", data.summary.upcomingCount],
          ["Tỷ lệ vắng", percent(data.summary.absenceRate)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        {data.member.subscription
          ? `Gói hiện tại: ${data.member.subscription.planName} · ${display(data.member.subscription.startDate)} – ${display(data.member.subscription.endDate)}`
          : "Không có gói tập đang hiệu lực."}
      </p>
      <h3>Lịch sử từng buổi</h3>
      {!data.sessions.length ? (
        <Empty text="Chưa có buổi học đủ điều kiện tính chuyên cần." />
      ) : (
        <div
          className="table-scroll"
          role="region"
          tabIndex={0}
          aria-label="Lịch sử điểm danh, có thể cuộn ngang"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Phòng</th>
                <th scope="col">Điểm danh</th>
                <th scope="col">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((session) => (
                <tr key={session.enrollmentId}>
                  <td>
                    {display(session.startTime)} – {display(session.endTime)}
                  </td>
                  <td>{session.roomName}</td>
                  <td>{labels[session.state] || session.state}</td>
                  <td>
                    {session.note === "SYSTEM_NO_SHOW"
                      ? "Ghi nhận vắng khi hoàn tất buổi học"
                      : session.note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>Lịch sử cảnh báo</h3>
      {data.warnings.length ? (
        data.warnings.map((warning) => (
          <p key={warning.id}>
            {display(warning.createdAt)} · {warning.body}
          </p>
        ))
      ) : (
        <p>Chưa gửi cảnh báo cho lớp này.</p>
      )}
      <h3>Báo cáo quản lý</h3>
      {data.reports.length ? (
        data.reports.map((report) => (
          <p key={report.id}>
            {display(report.createdAt)} ·{" "}
            {labels[report.status] || report.status}
            {report.response && ` · ${report.response}`}
          </p>
        ))
      ) : (
        <p>Chưa có báo cáo chuyên cần cho lớp này.</p>
      )}
    </section>
  );
}
