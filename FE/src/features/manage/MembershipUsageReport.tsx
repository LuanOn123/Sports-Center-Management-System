import { useState } from "react";
import type { MembershipReportOk } from "../../shared/generated";
import { money } from "../../shared/config";
import { Empty } from "../../shared/ui";

export type PlanUsage = {
  planId: string;
  planName: string;
  tier: string;
  soldCount: number;
  uniqueMembersCount?: number;
  activeSubscribers: number;
  revenue: number;
  enrollmentStats?: {
    totalClassEnrollments: number;
    enrolledMembersCount: number;
    classRegistrationCount: number;
    topClasses: {
      classId: string;
      className: string;
      sports: string[];
      enrollmentsCount: number;
      uniqueMembersCount: number;
    }[];
    memberUsage?: {
      memberId: string;
      memberName: string;
      totalBookings: number;
      classes: { classId: string; className: string; bookings: number }[];
    }[];
  };
};
export type MembershipUsageReportData = Omit<
  MembershipReportOk["data"],
  "plansBreakdown" | "topClasses"
> & {
  plansBreakdown?: PlanUsage[];
  unattributedEnrollments?: number;
  attributedEnrollments?: number;
};

export function MembershipUsageReport({
  data,
}: {
  data?: MembershipUsageReportData;
}) {
  const [planId, setPlanId] = useState("");
  const [search, setSearch] = useState("");
  if (!data) return null;
  const plans = (data.plansBreakdown ?? []).filter(
    (plan) => plan.tier !== "FREE",
  );
  const exactUsage = typeof data.attributedEnrollments === "number";
  const selected = plans.filter((plan) => !planId || plan.planId === planId);
  const popular = [...plans].sort(
    (a, b) =>
      (b.uniqueMembersCount ?? 0) - (a.uniqueMembersCount ?? 0) ||
      b.soldCount - a.soldCount,
  )[0];
  return (
    <section className="panel membership-usage-report">
      <div className="panel-heading">
        <div>
          <h2>Gói tập và nhu cầu lớp học</h2>
          <p>
            Theo ngày đăng ký trong khoảng đã chọn. Lượt đặt buổi khác với số
            hội viên: đăng ký trọn khóa có thể tạo nhiều lượt đặt.
          </p>
        </div>
      </div>
      <div className="membership-usage-body">
        {!!popular?.soldCount && (
          <p>
            Gói được nhiều hội viên mua nhất:{" "}
            <strong>{popular.planName}</strong> ·{" "}
            {popular.uniqueMembersCount ?? 0} hội viên · {popular.soldCount}{" "}
            lượt mua.
          </p>
        )}
        {!!data.unattributedEnrollments && (
          <p className="usage-data-note" role="status">
            Có {data.unattributedEnrollments} lượt đặt cũ chưa ghi nhận gói sử
            dụng, được tách khỏi thống kê theo gói. Hệ thống không gán các lượt
            này cho gói hiện tại của hội viên.
          </p>
        )}
        <div className="table-scroll">
          <table>
            <caption>Phân bổ theo gói tập</caption>
            <thead>
              <tr>
                <th>Gói tập</th>
                <th>Lượt mua</th>
                <th>Người mua khác nhau</th>
                <th>Đang hiệu lực</th>
                <th>Hội viên đặt lớp</th>
                <th>Đăng ký lớp khác nhau</th>
                <th>Lượt đặt buổi</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.planId}>
                  <td>
                    <strong>{plan.planName}</strong>
                  </td>
                  <td>{plan.soldCount ?? 0}</td>
                  <td>{plan.uniqueMembersCount ?? 0}</td>
                  <td>{plan.activeSubscribers ?? 0}</td>
                  <td>
                    {exactUsage
                      ? (plan.enrollmentStats?.enrolledMembersCount ?? 0)
                      : "—"}
                  </td>
                  <td>
                    {exactUsage
                      ? (plan.enrollmentStats?.classRegistrationCount ?? 0)
                      : "—"}
                  </td>
                  <td>
                    {exactUsage
                      ? (plan.enrollmentStats?.totalClassEnrollments ?? 0)
                      : "—"}
                  </td>
                  <td>{money(plan.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!plans.length ? (
          <Empty text="Chưa có gói trả phí để thống kê." />
        ) : !exactUsage ? (
          <Empty
            text="Chưa có dữ liệu liên kết gói với lượt đăng ký lớp."
            detail="Số lượt mua vẫn được hiển thị. Thống kê lớp theo gói sẽ xuất hiện khi hệ thống ghi nhận gói tại thời điểm đặt lớp."
          />
        ) : (
          <>
            <div className="filters">
              <label>
                Gói cần theo dõi
                <select
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                >
                  <option value="">Tất cả gói</option>
                  {plans.map((plan) => (
                    <option value={plan.planId} key={plan.planId}>
                      {plan.planName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tìm hội viên
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tên hội viên"
                />
              </label>
            </div>
            <p>
              Lượt mua và doanh thu tính tại cơ sở phát hành. Nhu cầu lớp tính
              tại cơ sở tổ chức lớp, kể cả gói được mua ở cơ sở khác. Gói mua
              trước khoảng báo cáo vẫn được tính nếu dùng để đặt lớp trong
              khoảng này.
            </p>
            {selected.map((plan) => (
              <article className="usage-plan" key={plan.planId}>
                <h3>{plan.planName} · Lớp được chọn nhiều nhất</h3>
                {!plan.enrollmentStats?.topClasses.length ? (
                  <Empty text="Chưa có lượt đặt được ghi nhận cho gói này." />
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Lớp học</th>
                          <th>Bộ môn</th>
                          <th>Hội viên khác nhau</th>
                          <th>Lượt đặt buổi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.enrollmentStats.topClasses
                          .slice(0, 10)
                          .map((row) => (
                            <tr key={row.classId}>
                              <td>{row.className}</td>
                              <td>{row.sports.join(", ")}</td>
                              <td>{row.uniqueMembersCount}</td>
                              <td>{row.enrollmentsCount}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <details>
                  <summary>Hội viên sử dụng gói này để học lớp nào</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Hội viên</th>
                          <th>Các lớp đã đăng ký bằng gói</th>
                          <th>Tổng lượt đặt buổi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(plan.enrollmentStats?.memberUsage ?? [])
                          .filter((row) =>
                            row.memberName
                              .toLocaleLowerCase("vi")
                              .includes(search.toLocaleLowerCase("vi")),
                          )
                          .slice(0, 50)
                          .map((row) => (
                            <tr key={row.memberId}>
                              <td>{row.memberName}</td>
                              <td>
                                {row.classes
                                  .map(
                                    (cls) =>
                                      `${cls.className} (${cls.bookings} buổi)`,
                                  )
                                  .join(" · ")}
                              </td>
                              <td>{row.totalBookings}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="field-note">
                    Hiển thị tối đa 50 hội viên khớp tên tìm kiếm, ưu tiên số
                    lượt đặt cao nhất. Chỉ tính đăng ký đang giữ chỗ hoặc đã
                    hoàn tất; lượt hủy được loại trừ.
                  </p>
                </details>
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
