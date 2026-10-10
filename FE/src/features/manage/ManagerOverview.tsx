import { ManagerAnalytics } from "./ManagerAnalytics";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type RecordData } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { money } from "../../shared/config";
import { Empty, ErrorState, Loading } from "../../shared/ui";
import { Table } from "../../shared/Table";

type Revenue = {
  totalRevenue: number;
  netRevenue: number;
  netRevenueVerified: boolean;
  unreconciledRefunds: number;
  refundedAmount: number;
  totalPayments: number;
  successPayments: number;
  revenueByMethod: Record<string, number>;
  recentPayments: RecordData[];
  note?: string;
};
export function ManagerOverview({ reports = false }: { reports?: boolean }) {
  return reports ? <ManagerRevenue /> : <ManagerAnalytics />;
}
function ManagerRevenue() {
  const reports = true;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const valid = Boolean(from && to && from <= to);
  const revenue = useQuery({
    queryKey: ["manager-revenue", getFacilityId(), from, to],
    queryFn: ({ signal }) =>
      api<Revenue>("GET /reports/revenue", {
        query: { startDate: from, endDate: to },
        signal,
      }),
    enabled: valid,
  });
  const data = revenue.data?.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {reports ? "TÀI CHÍNH CƠ SỞ" : "KHÔNG GIAN QUẢN LÝ"}
          </span>
          <h1>{reports ? "Báo cáo doanh thu" : "Tổng quan cơ sở"}</h1>
          <p>
            {reports
              ? "Dòng tiền của cơ sở bạn quản lý. Báo cáo chỉ đọc."
              : "Nhân sự, phòng tập và lịch lớp học trong cùng một không gian."}
          </p>
        </div>
      </div>
      {!reports && (
        <div className="shortcut-grid">
          {[
            ["users", "Nhân sự", "Phân công Coach và quản lý đội ngũ"],
            ["rooms", "Phòng tập", "Cấu hình và theo dõi sử dụng phòng"],
            ["classes", "Lớp học", "Thông tin lớp và phân công giảng dạy"],
            ["schedules", "Lịch hoạt động", "Theo dõi các buổi học tại cơ sở"],
          ].map(([path, title, text]) => (
            <Link className="shortcut-card" key={path} to={`/manager/${path}`}>
              <h2>{title}</h2>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Doanh thu trong kỳ</h2>
          <div className="filters">
            <label>
              Từ ngày
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        </div>
        {!valid ? (
          <p role="alert" className="error-state">
            Chọn khoảng ngày hợp lệ.
          </p>
        ) : revenue.isPending ? (
          <Loading />
        ) : revenue.error ? (
          <ErrorState error={revenue.error} retry={() => revenue.refetch()} />
        ) : (
          data && (
            <div className="manager-revenue-body">
              <div className="stats-grid">
                {[
                  ["Thực thu", money(data.totalRevenue)],
                  ["Đã hoàn", money(data.refundedAmount)],
                  ["Thực nhận", money(data.netRevenue)],
                  ["Giao dịch thu được", String(data.successPayments)],
                ].map(([title, value]) => (
                  <div className="stat-card" key={title}>
                    <p>{title}</p>
                    <strong className="stat-value">{value}</strong>
                  </div>
                ))}
              </div>
              <p className="field-note">{data.note}</p>
              {data.netRevenueVerified === false && (
                <p role="status">
                  Có {data.unreconciledRefunds} khoản hoàn chưa đối soát. Số
                  thực nhận chưa được xác minh đầy đủ.
                </p>
              )}
              {data.recentPayments.length ? (
                <Table
                  rows={data.recentPayments}
                  columns={[
                    ["member.user.fullName", "Hội viên"],
                    ["amount", "Số tiền"],
                    ["method", "Phương thức"],
                    ["status", "Trạng thái"],
                    ["paidAt", "Ngày thu"],
                  ]}
                />
              ) : (
                <Empty text="Chưa có giao dịch trong kỳ" />
              )}
            </div>
          )
        )}
      </section>
    </>
  );
}
