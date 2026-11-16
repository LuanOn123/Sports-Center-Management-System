import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { display } from "../../shared/config";
import { getFacilityId } from "../../shared/facility";
import { Empty, ErrorState, Loading, Modal } from "../../shared/ui";
import { useDebouncedValue } from "../../shared/useDebouncedValue";

type Pair = { memberId: string; classId: string };
type AttendanceRow = Pair & {
  memberName: string;
  className: string;
  attendedCount: number;
  absentCount: number;
  absenceRate: number;
  status: "NORMAL" | "WARNING" | "VIOLATION";
  warningSent: boolean;
  reportStatus?: "PENDING" | "APPROVED" | "REJECTED";
};
type Detail = {
  summary: AttendanceRow;
  sessions: {
    scheduleId: string;
    startTime: string;
    roomName: string;
    state: string;
    note?: string | null;
  }[];
};
const labels = {
  NORMAL: "Bình thường",
  WARNING: "Cần nhắc nhở",
  VIOLATION: "Vi phạm",
};

export function ReceptionAttendance() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AttendanceRow | null>(null);
  const query = useDebouncedValue(search);
  const facilityId = getFacilityId();
  const monitoring = useQuery({
    queryKey: ["reception-attendance", facilityId, query, status, page],
    queryFn: ({ signal }) =>
      api<AttendanceRow[]>("GET /attendance/monitoring", {
        query: { search: query, status, page: String(page), limit: "20" },
        signal,
      }),
  });
  return (
    <div className="workflow-page">
      <h1>Chuyên cần hội viên</h1>
      <section className="panel">
        <div className="filters">
          <label>
            Tìm hội viên
            <input
              type="search"
              maxLength={100}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {Object.entries(labels).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {monitoring.isPending ? (
          <Loading />
        ) : monitoring.error ? (
          <ErrorState
            error={monitoring.error}
            retry={() => monitoring.refetch()}
          />
        ) : monitoring.data.data.length ? (
          <>
            <div className="detail-list">
              {monitoring.data.data.map((row) => (
                <article
                  key={`${row.memberId}-${row.classId}`}
                  className="workflow-card"
                >
                  <h2>
                    {row.memberName} · {row.className}
                  </h2>
                  <p>
                    {labels[row.status]} · Có mặt {row.attendedCount} · Vắng{" "}
                    {row.absentCount} ({row.absenceRate}%)
                  </p>
                  <button className="button" onClick={() => setSelected(row)}>
                    Xem chuyên cần
                  </button>
                </article>
              ))}
            </div>
            <div className="pagination">
              <button
                className="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </button>
              <span>Trang {page}</span>
              <button
                className="button"
                disabled={page >= (monitoring.data.pagination?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        ) : (
          <Empty text="Chưa có hội viên phù hợp." />
        )}
      </section>
      {selected && (
        <AttendanceDetail
          row={selected}
          facilityId={facilityId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function AttendanceDetail({
  row,
  facilityId,
  onClose,
}: {
  row: AttendanceRow;
  facilityId: string;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [reason, setReason] = useState("");
  const queryKey = [
    "reception-attendance-detail",
    facilityId,
    row.memberId,
    row.classId,
  ];
  const pair = { memberId: row.memberId, classId: row.classId };
  const detail = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      api<Detail>("GET /attendance/monitoring/detail", { query: pair, signal }),
  });
  const submit = useMutation({
    mutationFn: (action: "warning" | "report") =>
      action === "warning"
        ? api("POST /attendance/warnings/send", { body: pair })
        : api("POST /attendance/reports", {
            body: { ...pair, reason: reason.trim() },
          }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey }),
        cache.invalidateQueries({
          queryKey: ["reception-attendance", facilityId],
        }),
        cache.invalidateQueries({
          queryKey: ["operations", "issues", facilityId],
        }),
      ]);
    },
  });
  const data = detail.data?.data;
  return (
    <Modal
      title={`${row.memberName} · ${row.className}`}
      onClose={onClose}
      dismissible={!submit.isPending}
      scrollBody
    >
      {detail.isPending ? (
        <Loading />
      ) : detail.error ? (
        <ErrorState error={detail.error} retry={() => detail.refetch()} />
      ) : (
        data && (
          <>
            <h3>Lịch sử theo buổi</h3>
            {data.sessions.length ? (
              <ul>
                {data.sessions.map((session) => (
                  <li key={session.scheduleId}>
                    {display(session.startTime)} · {session.roomName} ·{" "}
                    {display(session.state)}
                    {session.note && ` · ${session.note}`}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Chưa có buổi học để theo dõi." />
            )}
            {data.summary.warningSent && <p>Đã gửi cảnh báo.</p>}
            {data.summary.status !== "NORMAL" && !data.summary.warningSent && (
              <button
                className="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate("warning")}
              >
                Gửi cảnh báo
              </button>
            )}
            {data.summary.reportStatus && (
              <p>Báo cáo vi phạm · {display(data.summary.reportStatus)}</p>
            )}
            {data.summary.status === "VIOLATION" &&
              data.summary.reportStatus !== "PENDING" &&
              data.summary.reportStatus !== "APPROVED" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!submit.isPending && reason.trim().length >= 5)
                      submit.mutate("report");
                  }}
                >
                  <label>
                    Lý do báo cáo
                    <textarea
                      required
                      minLength={5}
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <button
                    className="button primary"
                    type="submit"
                    disabled={submit.isPending || reason.trim().length < 5}
                  >
                    Gửi báo cáo cho quản lý
                  </button>
                </form>
              )}
            {submit.error && <ErrorState error={submit.error} />}
            {submit.isSuccess && (
              <p role="status">
                Đã gửi {submit.variables === "warning" ? "cảnh báo" : "báo cáo"}
                .
              </p>
            )}
          </>
        )
      )}
    </Modal>
  );
}
