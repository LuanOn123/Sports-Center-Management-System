import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { money, label } from "../../shared/config";
import { ErrorState, Loading } from "../../shared/ui";
import { Card, Ranking } from "../../shared/analytics/Charts";
import { ScheduleAnalytics } from "../../shared/analytics/ScheduleAnalytics";
import { dashboardRows, dayKey, daysAgo } from "../../shared/analytics/data";
export function ManagerAnalytics() {
  const [period, setPeriod] = useState(30);
  const end = dayKey(new Date()),
    start = daysAgo(end, period - 1),
    facility = getFacilityId();
  const schedules = useQuery({
    queryKey: ["dashboard-schedules", facility, start, end],
    queryFn: ({ signal }) =>
      dashboardRows(
        "GET /class-schedules",
        {
          startAfter: `${start}T00:00:00+07:00`,
          startBefore: `${end}T23:59:59.999+07:00`,
        },
        signal,
      ),
  });
  const revenue = useQuery({
    queryKey: ["manager-revenue", facility, start, end],
    queryFn: ({ signal }) =>
      api<{
        totalRevenue: number;
        netRevenue: number;
        refundedAmount: number;
        successPayments: number;
        revenueByMethod: Record<string, number>;
        netRevenueVerified?: boolean;
        unreconciledRefunds?: number;
      }>("GET /reports/revenue", {
        query: { startDate: start, endDate: end },
        signal,
      }),
  });
  const finance = (
    <Card title="Dòng tiền cơ sở" note="Trong kỳ đang chọn">
      {revenue.isPending ? (
        <Loading variant="field" />
      ) : revenue.isError ? (
        <ErrorState error={revenue.error} retry={() => revenue.refetch()} />
      ) : (
        <>
          <dl className="analytics-summary analytics-finance">
            {[
              ["Thực nhận", money(revenue.data.data.netRevenue)],
              ["Thực thu", money(revenue.data.data.totalRevenue)],
              ["Đã hoàn", money(revenue.data.data.refundedAmount)],
              ["Giao dịch thu được", String(revenue.data.data.successPayments)],
            ].map(([title, value]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {revenue.data.data.netRevenueVerified === false && (
            <p role="status">
              Có {revenue.data.data.unreconciledRefunds} khoản hoàn chưa đối
              soát. Số thực nhận chưa được xác minh đầy đủ.
            </p>
          )}
          <details className="analytics-finance-methods">
            <summary>Phương thức thanh toán</summary>
            <div>
              <p>Giá trị giao dịch SUCCESS, không gồm giao dịch đã hoàn.</p>
              <Ranking
                data={Object.entries(
                  revenue.data.data.revenueByMethod ?? {},
                ).map(([key, value]) => ({ label: label(key), value }))}
                format={money}
              />
            </div>
          </details>
        </>
      )}
    </Card>
  );
  return (
    <div className="analytics-dashboard analytics-workbench">
      <div className="analytics-workbench-header">
        <h1>Tổng quan cơ sở</h1>
        <div className="analytics-toolbar">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              className={`button ${period === days ? "primary" : ""}`}
              aria-pressed={period === days}
              onClick={() => setPeriod(days)}
            >
              {days} ngày
            </button>
          ))}
          <span>
            {start} — {end}
          </span>
        </div>
        <details className="analytics-quick-menu">
          <summary>Truy cập nhanh</summary>{" "}
          <nav className="analytics-shortcuts" aria-label="Thao tác quản lý">
            {[
              ["users", "Nhân sự"],
              ["rooms", "Phòng tập"],
              ["classes", "Lớp học"],
              ["schedules", "Lịch hoạt động"],
              ["reports", "Báo cáo doanh thu"],
            ].map(([path, title]) => (
              <Link key={path} className="button" to={`/manager/${path}`}>
                {title}
              </Link>
            ))}
          </nav>
        </details>
      </div>
      {schedules.isPending ? (
        <>
          <Loading variant="chart" />
          {finance}
        </>
      ) : schedules.isError ? (
        <>
          <ErrorState
            error={schedules.error}
            retry={() => schedules.refetch()}
          />
          {finance}
        </>
      ) : (
        <ScheduleAnalytics
          rows={schedules.data}
          start={start}
          end={end}
          summary={finance}
        />
      )}
    </div>
  );
}
