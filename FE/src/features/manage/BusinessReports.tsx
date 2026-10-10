import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { display } from "../../shared/config";
import { Empty, ErrorState, Loading } from "../../shared/ui";

type UsageReport = {
  originFacilityName: string;
  totalBookings: number;
  totalVisits: number;
  totalUniqueMembers: number;
  usage: Array<{
    usageFacilityId: string;
    usageFacilityName: string;
    bookings: number;
    visits: number;
    uniqueMembers: number;
  }>;
};
type AttendanceReport = {
  summary: { total: number; normal: number; notice: number; warning: number };
  rows: Array<{
    memberId: string;
    memberName: string;
    classId: string;
    className: string;
    policy: string;
    status: string;
    sampleSize: number;
    attendanceRate: number;
    currentAbsences: number;
    allowedAbsences: number;
  }>;
};

export function BusinessReports({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const usage = useQuery({
    queryKey: ["report", "cross-facility", startDate, endDate],
    queryFn: ({ signal }) =>
      api<UsageReport>("GET /reports/cross-facility-usage", {
        query: { startDate, endDate },
        signal,
      }),
    enabled: Boolean(startDate && endDate && startDate <= endDate),
  });
  const attendance = useQuery({
    queryKey: ["report", "attendance", status, page],
    queryFn: ({ signal }) =>
      api<AttendanceReport>("GET /reports/attendance", {
        query: { status, page: String(page), limit: "20" },
        signal,
      }),
  });
  return (
    <div className="workflow-page">
      <section className="panel">
        <h2>Sử dụng liên cơ sở</h2>
        <p>
          Hội viên từng mua gói tại cơ sở đang chọn sử dụng lớp và vào cửa ở đâu
          trong kỳ báo cáo.
        </p>
        {!startDate || !endDate || startDate > endDate ? (
          <Empty text="Chọn khoảng ngày hợp lệ." />
        ) : usage.isPending ? (
          <Loading />
        ) : usage.isError ? (
          <ErrorState error={usage.error} retry={() => usage.refetch()} />
        ) : (
          <>
            <p>
              Gốc phát hành: {usage.data.data.originFacilityName} ·{" "}
              {usage.data.data.totalBookings} lượt đặt ·{" "}
              {usage.data.data.totalVisits} lượt vào cửa ·{" "}
              {usage.data.data.totalUniqueMembers} hội viên
            </p>
            {!usage.data.data.usage.length ? (
              <Empty text="Chưa có lượt sử dụng trong kỳ." />
            ) : (
              <div className="detail-list">
                {usage.data.data.usage.map((row) => (
                  <article className="workflow-card" key={row.usageFacilityId}>
                    <h3>{row.usageFacilityName}</h3>
                    <p>
                      {row.bookings} lượt đặt · {row.visits} lượt vào cửa ·{" "}
                      {row.uniqueMembers} hội viên
                    </p>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <section className="panel">
        <h2>Báo cáo chuyên cần</h2>
        <p>
          Tổng hợp theo hội viên và lớp tại cơ sở đang chọn. Dữ liệu theo chính
          sách chuyên cần của lớp, độc lập với khoảng ngày của báo cáo doanh
          thu.
        </p>
        <label>
          Trạng thái chuyên cần
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {["NORMAL", "NOTICE", "WARNING"].map((value) => (
              <option key={value} value={value}>
                {display(value)}
              </option>
            ))}
          </select>
        </label>
        {attendance.isPending ? (
          <Loading />
        ) : attendance.isError ? (
          <ErrorState
            error={attendance.error}
            retry={() => attendance.refetch()}
          />
        ) : (
          <>
            <p>
              Tổng trước lọc: {attendance.data.data.summary.total} · Bình thường{" "}
              {attendance.data.data.summary.normal} · Nhắc nhở{" "}
              {attendance.data.data.summary.notice} · Cảnh báo{" "}
              {attendance.data.data.summary.warning}
            </p>
            {!attendance.data.data.rows.length ? (
              <Empty text="Chưa có dữ liệu phù hợp." />
            ) : (
              <div className="detail-list">
                {attendance.data.data.rows.map((row) => (
                  <article
                    className="workflow-card"
                    key={`${row.memberId}-${row.classId}`}
                  >
                    <h3>
                      {row.memberName} · {row.className}
                    </h3>
                    <p>
                      {display(row.status)} · {row.sampleSize} buổi ·{" "}
                      {row.policy === "FIXED"
                        ? `Đã vắng ${row.currentAbsences}/${row.allowedAbsences} buổi cho phép`
                        : `Tỷ lệ ${row.attendanceRate}%`}
                    </p>
                  </article>
                ))}
              </div>
            )}
            <div className="workflow-actions">
              <button
                className="button small"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </button>
              <span>
                Trang {page}/
                {Math.max(1, attendance.data.pagination?.totalPages ?? 1)}
              </span>
              <button
                className="button small"
                disabled={page >= (attendance.data.pagination?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
