import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  TrendingUp,
  CalendarCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "../../shared/api";
import { money } from "../../shared/config";
import { Empty, ErrorState, Loading } from "../../shared/ui";
import "./admin.css";

type FacilityMetric = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  managers: string[];
  netRevenue: number;
  totalRevenue: number;
  refundedAmount: number;
  members: number;
  bookings: number;
  cancelledBookings: number;
  sessions: number;
};
type Overview = {
  facilities: FacilityMetric[];
  totalMembers: number;
  totalBookings: number;
  netRevenue: number;
  totalRevenue: number;
  refundedAmount: number;
};
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function Chart({
  rows,
  metric,
  title,
  note,
  currency = false,
}: {
  rows: FacilityMetric[];
  metric: "netRevenue" | "members" | "bookings";
  title: string;
  note: string;
  currency?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r[metric])));
  return (
    <section className="panel admin-chart">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </div>
      {rows.map((r) => (
        <div className="admin-bar-row" key={r.id}>
          <div>
            <strong>{r.name}</strong>
            <span>
              {currency ? money(r[metric]) : r[metric].toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="admin-bar-track">
            <div
              className={r[metric] < 0 ? "negative" : ""}
              style={{ width: `${(Math.abs(r[metric]) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
export function AdminDashboard() {
  const [range, setRange] = useState(() => ({
    startDate: today().slice(0, 7) + "-01",
    endDate: today(),
  }));
  const valid = Boolean(
    range.startDate && range.endDate && range.startDate <= range.endDate,
  );
  const q = useQuery({
    queryKey: ["admin-facility-overview", range],
    queryFn: ({ signal }) =>
      api<Overview>("GET /reports/facilities", { query: range, signal }),
    enabled: valid,
  });
  const data = q.data?.data;
  return (
    <div className="workflow-page admin-workspace">
      <section className="admin-overview-hero">
        <div>
          <div className="eyebrow">TOÀN HỆ THỐNG</div>
          <h1>Tổng quan trung tâm</h1>
          <p>Nắm nhịp kinh doanh và hoạt động của từng cơ sở.</p>
        </div>
        <Building2 size={62} strokeWidth={1} />
      </section>
      <div className="workflow-actions">
        <Link className="button" to="/admin/schedules">
          Xem lịch hoạt động
        </Link>
        <Link className="button" to="/admin/facilities">
          Quản lý cơ sở
        </Link>
        <Link className="button" to="/admin/audit">
          Xem nhật ký hoạt động
        </Link>
      </div>
      <div className="admin-report-toolbar">
        <label>
          Từ ngày
          <input
            aria-label="Từ ngày báo cáo"
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange({ ...range, startDate: e.target.value })}
          />
        </label>
        <label>
          Đến ngày
          <input
            aria-label="Đến ngày báo cáo"
            type="date"
            value={range.endDate}
            min={range.startDate}
            onChange={(e) => setRange({ ...range, endDate: e.target.value })}
          />
        </label>
        <button
          className="button"
          disabled={!valid || q.isFetching}
          onClick={() => q.refetch()}
        >
          <RefreshCw size={16} />
          Làm mới
        </button>
        <span>Số liệu toàn hệ thống, gồm mọi cơ sở.</span>
      </div>
      {!valid ? (
        <p className="field-note danger-text">Chọn khoảng ngày hợp lệ.</p>
      ) : q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        data && (
          <>
            <div className="admin-stat-grid">
              {[
                [
                  TrendingUp,
                  "Doanh thu sau hoàn tiền",
                  money(data.netRevenue),
                  `Đã thu ${money(data.totalRevenue)} · Hoàn ${money(data.refundedAmount)}`,
                ],
                [
                  Building2,
                  "Cơ sở hoạt động",
                  data.facilities.filter((f) => f.isActive).length,
                  `${data.facilities.length} cơ sở trong hệ thống`,
                ],
                [
                  Users,
                  "Hội viên đã mua gói",
                  data.totalMembers,
                  "Hội viên đang hoạt động, đếm một lần toàn hệ thống",
                ],
                [
                  CalendarCheck,
                  "Lượt đăng ký",
                  data.totalBookings,
                  "Đang giữ chỗ và hoàn tất trong khoảng ngày",
                ],
              ].map(([Icon, title, value, note]) => {
                const Glyph = Icon as typeof Users;
                return (
                  <article className="panel admin-stat" key={String(title)}>
                    <Glyph size={22} />
                    <span>{String(title)}</span>
                    <strong>{String(value)}</strong>
                    <small>{String(note)}</small>
                  </article>
                );
              })}
            </div>
            {!data.facilities.length ? (
              <Empty text="Chưa có dữ liệu cơ sở" />
            ) : (
              <>
                <div className="admin-chart-grid">
                  <Chart
                    rows={data.facilities}
                    metric="netRevenue"
                    title="Doanh thu theo cơ sở"
                    note="Khoản thu trong kỳ trừ tiền hoàn trong kỳ (VNĐ)."
                    currency
                  />
                  <Chart
                    rows={data.facilities}
                    metric="members"
                    title="Hội viên theo cơ sở"
                    note="Hội viên hoạt động đã mua gói tại cơ sở, tính mọi thời điểm."
                  />
                  <Chart
                    rows={data.facilities}
                    metric="bookings"
                    title="Lượt đăng ký theo cơ sở"
                    note="Theo ngày đăng ký trong kỳ, không gồm lượt đã hủy."
                  />
                </div>
                <p className="field-note">
                  Một hội viên có thể mua gói tại nhiều cơ sở nên tổng các cột
                  hội viên có thể lớn hơn số hội viên toàn hệ thống. Gói dùng
                  thử miễn phí không được tính vào hội viên đã mua gói.
                </p>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Hoạt động từng cơ sở</h2>
                      <p>
                        Đối chiếu quản lý phụ trách, lịch học và lượt đăng ký.
                      </p>
                    </div>
                  </div>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Hoạt động từng cơ sở, có thể cuộn ngang"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Cơ sở</th>
                          <th>Quản lý</th>
                          <th>Buổi học</th>
                          <th>Đăng ký</th>
                          <th>Đã hủy</th>
                          <th>Doanh thu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.facilities.map((f) => (
                          <tr key={f.id}>
                            <td>
                              <strong>{f.name}</strong>
                              <div>
                                {f.code} ·{" "}
                                {f.isActive
                                  ? "Đang hoạt động"
                                  : "Ngừng hoạt động"}
                              </div>
                            </td>
                            <td>{f.managers.join(", ") || "Chưa phân công"}</td>
                            <td>{f.sessions}</td>
                            <td>{f.bookings}</td>
                            <td>{f.cancelledBookings}</td>
                            <td>{money(f.netRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
