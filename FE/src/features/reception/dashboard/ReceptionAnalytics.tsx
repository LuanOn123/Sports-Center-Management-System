import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFacilityId } from "../../../shared/facility";
import { api } from "../../../shared/api";
import { ErrorState, Loading } from "../../../shared/ui";
import { display } from "../../../shared/config";
import {
  Card,
  Columns,
  Gauge,
  Kpi,
  Ranking,
  Timeline,
  Radar,
} from "../../../shared/analytics/Charts";
import {
  daily,
  dashboardRows,
  dayKey,
  daysAgo,
  group,
  weekdays,
} from "../../../shared/analytics/data";
export function ReceptionAnalytics() {
  const [period, setPeriod] = useState(7);
  const end = dayKey(new Date()),
    start = daysAgo(end, period - 1),
    facility = getFacilityId();
  const payments = useQuery({
    queryKey: ["reception-dashboard-payments", facility, start, end],
    queryFn: ({ signal }) =>
      dashboardRows(
        "GET /payments",
        {
          startDate: `${start}T00:00:00+07:00`,
          endDate: `${end}T23:59:59.999+07:00`,
        },
        signal,
      ),
  });
  const attendance = useQuery({
    queryKey: ["reception-dashboard-attendance", facility],
    queryFn: ({ signal }) =>
      dashboardRows("GET /attendance/monitoring", {}, signal),
  });
  const unread = useQuery({
    queryKey: ["chat", "unread-count"],
    queryFn: ({ signal }) =>
      api<{ unreadCount: number }>("GET /chat/messages/unread-count", {
        signal,
      }),
    staleTime: 30000,
  });
  const rows = payments.data ?? [],
    success = rows.filter((r) => r.status === "SUCCESS"),
    pending = rows.filter((r) => r.status === "PENDING");
  const monitor = attendance.data ?? [],
    warning = monitor.filter((r) => r.status === "WARNING").length,
    violation = monitor.filter((r) => r.status === "VIOLATION").length;
  return (
    <div className="analytics-dashboard">
      <div className="analytics-toolbar">
        {[7, 30, 90].map((days) => (
          <button
            className={`button ${period === days ? "primary" : ""}`}
            aria-pressed={period === days}
            key={days}
            onClick={() => setPeriod(days)}
          >
            {days} ngày
          </button>
        ))}
        <span>
          {start} — {end} · Theo ngày tạo giao dịch
        </span>
      </div>
      {payments.isPending ? (
        <Loading variant="cards" />
      ) : payments.isError ? (
        <ErrorState error={payments.error} retry={() => payments.refetch()} />
      ) : (
        <>
          <div className="analytics-layout">
            <div className="analytics-main">
              <div className="analytics-kpis">
                <Kpi
                  title="Giao dịch tạo hôm nay"
                  value={rows.filter((r) => dayKey(r.createdAt) === end).length}
                  note="Trong tập giao dịch đang xem"
                  part={rows.filter((r) => dayKey(r.createdAt) === end).length}
                  total={rows.length}
                />
                <Kpi
                  title="Thanh toán thành công"
                  value={success.length}
                  note="Trạng thái hiện tại của giao dịch tạo trong kỳ"
                  part={success.length}
                  total={rows.length}
                />
                <Kpi
                  title="Chờ thanh toán"
                  value={pending.length}
                  note="Trạng thái hiện tại của giao dịch tạo trong kỳ"
                  part={pending.length}
                  total={rows.length}
                />
                <Kpi
                  title="Giao dịch mua gói"
                  value={
                    rows.filter((r) =>
                      Boolean(r.subscriptionId || r.subscription),
                    ).length
                  }
                  note="Có liên kết đăng ký gói, không phải số gói kích hoạt"
                  part={
                    rows.filter((r) =>
                      Boolean(r.subscriptionId || r.subscription),
                    ).length
                  }
                  total={rows.length}
                />
              </div>

              <Card
                title="Nhịp giao dịch tại cơ sở"
                note="Số giao dịch theo ngày tạo (GMT+7), gồm mọi trạng thái. Không phải doanh thu theo ngày thu."
              >
                <Timeline
                  data={daily(rows, "createdAt", start, end)}
                  title="Giao dịch tạo mới"
                />
              </Card>
              <div className="analytics-analysts">
                <Card title="Phân tích phương thức">
                  <Ranking data={group(rows, (r) => display(r.method))} />
                </Card>
                <Card title="Trạng thái giao dịch">
                  <Columns
                    data={group(rows, (r) => display(r.status))}
                    primary="Giao dịch"
                  />
                </Card>
              </div>
            </div>
            <aside className="analytics-side">
              <Card title="Đối chiếu phương thức" note="Giao dịch tạo trong kỳ">
                <Columns
                  data={group(rows, (r) => display(r.method)).map((d) => ({
                    ...d,
                    secondary: success.filter(
                      (r) => display(r.method) === d.label,
                    ).length,
                  }))}
                  primary="Tất cả"
                  secondary="Thành công"
                  variant="lollipop"
                />
              </Card>
              <Card
                title="Nhịp giao dịch theo thứ"
                note="Số giao dịch tạo trong kỳ, cộng theo thứ; cùng thang đo."
              >
                <Radar
                  data={weekdays(
                    rows,
                    "createdAt",
                    (r) => r.status === "SUCCESS",
                  )}
                  primary="Tất cả"
                  secondary="Thành công"
                />
              </Card>
              <Card title="Tỷ lệ thanh toán">
                <Gauge
                  part={success.length}
                  total={rows.length}
                  label="Thành công / giao dịch tạo trong kỳ"
                />
              </Card>
              <Card title="Tin nhắn chưa đọc">
                {unread.isPending ? (
                  <Loading variant="field" />
                ) : unread.isError ? (
                  <ErrorState
                    error={unread.error}
                    retry={() => unread.refetch()}
                  />
                ) : (
                  <strong>{unread.data.data.unreadCount}</strong>
                )}
              </Card>
            </aside>
          </div>
        </>
      )}
      <Card
        title="Theo dõi chuyên cần"
        note="Trạng thái hiện tại theo từng cặp hội viên–lớp, độc lập với kỳ giao dịch. Một hội viên có thể học nhiều lớp."
      >
        {attendance.isPending ? (
          <Loading variant="cards" />
        ) : attendance.isError ? (
          <ErrorState
            error={attendance.error}
            retry={() => attendance.refetch()}
          />
        ) : (
          <div className="analytics-kpis">
            <Kpi
              title="Đang theo dõi"
              value={monitor.length}
              note="Cặp hội viên–lớp"
            />
            <Kpi
              title="Cảnh báo"
              value={warning}
              note="Cặp hội viên–lớp ở trạng thái WARNING"
              part={warning}
              total={monitor.length}
            />
            <Kpi
              title="Vi phạm"
              value={violation}
              note="Cặp hội viên–lớp ở trạng thái VIOLATION"
              part={violation}
              total={monitor.length}
            />
            <Kpi
              title="Báo cáo chờ duyệt"
              value={monitor.filter((r) => r.reportStatus === "PENDING").length}
              note="Cặp hội viên–lớp có báo cáo chờ quản lý"
              part={monitor.filter((r) => r.reportStatus === "PENDING").length}
              total={monitor.length}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
