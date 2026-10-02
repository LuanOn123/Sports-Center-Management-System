import { DistributionChart } from "../../shared/DistributionChart";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Dumbbell,
  MoveUpRight,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "../../shared/api";
import type { RecordData } from "../../shared/api";
import type {
  RevenueReportOk,
  MemberReportOk,
  EnrollmentReportOk,
  MembershipReportOk,
} from "../../shared/generated";
import { display, label, money } from "../../shared/config";
import { Empty, ErrorState, Loading } from "../../shared/ui";
function dateString(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
export function Dashboard({ reports = false }: { reports?: boolean }) {
  const today = dateString(new Date());
  const [startDate, setStart] = useState(today.slice(0, 7) + "-01");
  const [endDate, setEnd] = useState(today);
  const valid = Boolean(startDate && endDate && startDate <= endDate);
  const query = { startDate, endDate };
  const revenue = useQuery({
    queryKey: ["report", "revenue", query],
    queryFn: ({ signal }) =>
      api<RevenueReportOk["data"]>("GET /reports/revenue", { query, signal }),
    enabled: valid,
  });
  const members = useQuery({
    queryKey: ["report", "members", query],
    queryFn: ({ signal }) =>
      api<MemberReportOk["data"]>("GET /reports/members", { query, signal }),
    enabled: valid,
  });
  const enrollments = useQuery({
    queryKey: ["report", "enrollments", query],
    queryFn: ({ signal }) =>
      api<EnrollmentReportOk["data"]>("GET /reports/enrollments", {
        query,
        signal,
      }),
    enabled: valid,
  });
  const memberships = useQuery({
    queryKey: ["report", "memberships", query],
    queryFn: ({ signal }) =>
      api<MembershipReportOk["data"]>("GET /reports/memberships", {
        query,
        signal,
      }),
    enabled: valid,
  });
  const schedule = useQuery({
    queryKey: ["today-schedule", today],
    queryFn: ({ signal }) =>
      api<RecordData[]>("GET /class-schedules", {
        query: { date: today, limit: "5", page: "1" },
        signal,
      }),
    enabled: !reports,
  });
  const cards = [
    {
      title: "Doanh thu",
      icon: Wallet,
      q: revenue,
      value: revenue.data?.data.totalRevenue,
      money: true,
      sub: "Trong khoáº£ng thá»i gian Ä‘Ã£ chá»n",
      accent: "stat-revenue",
    },
    {
      title: "Tá»•ng há»™i viÃªn",
      icon: Users,
      q: members,
      value: members.data?.data.totalMembers,
      sub: "Cá»™ng Ä‘á»“ng cá»§a trung tÃ¢m",
      accent: "stat-members",
    },
    {
      title: "LÆ°á»£t Ä‘Äƒng kÃ½ lá»›p",
      icon: Dumbbell,
      q: enrollments,
      value: enrollments.data?.data.totalEnrollments,
      sub: "Trong káº»áººÌng thá»i gian Ä‘Ã£ chá»n",
      accent: "stat-enrollments",
    },
    {
      title: "GÃ³i Ä‘ang hiá»‡u lá»±c",
      icon: CreditCard,
      q: memberships,
      value: memberships.data?.data.activeSubscriptions,
      sub: "Sáºµn sÃ ng cho buá»•i táº­p tiáº¿p theo",
      accent: "stat-memberships",
    },
  ];
  function exportCsv() {
    const rows = [["BÃ¡o cÃ¡o", "Chá»‰ tiÃªu", "GiÃ¡ trá»‹", "Tá»« ngÃ y", "Äáº¿n ngÃ y"]];
    for (const [name, q] of [
      ["Doanh thu", revenue],
      ["Há»™i viÃªn", members],
      ["ÄÄƒng kÃ½ lá»›p", enrollments],
      ["GÃ³i thÃ nh viÃªn", memberships],
    ] as const) {
      if (q.data)
        for (const [k, v] of Object.entries(q.data.data)) {
          if (typeof v === "number")
            rows.push([name, label(k), String(v), startDate, endDate]);
          else if (v && typeof v === "object" && !Array.isArray(v))
            for (const [sub, n] of Object.entries(v))
              rows.push([name, label(sub), String(n), startDate, endDate]);
        }
    }
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((cell) => '"' + String(cell).replace(/"/g, '""') + '"')
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-reports-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {reports
              ? "HIá»‚U Dá»® LIá»†U. DáºªN Dáº®T TÄ‚NG TRÆ¯á»žNG."
              : "Má»–I NGÃ€Y LÃ€ Má»˜T BÆ¯á»šC TIáº¾N"}
          </div>
          <h1>
            {reports ? "BÃ¡o cÃ¡o & phÃ¢n tÃ­ch" : "Tá»•ng quan trung tÃ¢m"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {reports
              ? "Bá»©c tranh hoáº¡t Ä‘á»™ng, Ä‘Æ°á»£c cáº­p nháº­t tá»« dá»¯ liá»‡u thá»±c."
              : "ChÃ o ngÃ y má»›i! CÃ¹ng giá»¯ nhá»‹p váº­n hÃ nh trung tÃ¢m."}
          </p>
        </div>
        <div className="date-label">
          <CalendarDays size={17} />
          {new Date().toLocaleDateString("vi-VN", {
            weekday: "short",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
      <div className="section-heading">
        <h2>{reports ? "Hiá»‡u quáº£ hoáº¡t Ä‘á»™ng" : "Trung tÃ¢m trong táº§m tay"}</h2>
        <div className="date-range">
          <label>
            Tá»«
            <input
              aria-label="Tá»« ngÃ y"
              type="date"
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Äáº¿n
            <input
              aria-label="Äáº¿n ngÃ y"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {reports && (
            <button
              className="button small"
              disabled={
                !valid || cards.some((c) => !c.q.isSuccess || c.q.isFetching)
              }
              onClick={exportCsv}
            >
              <ArrowDownToLine size={16} />
              Xuáº¥t CSV
            </button>
          )}
        </div>
      </div>
      {!valid ? (
        <ErrorState
          error={
            new Error(
              "Chá»n khoáº£ng ngÃ y há»£p lá»‡: ngÃ y káº¿t thÃºc pháº£i báº±ng hoáº·c sau ngÃ y báº¯t Ä‘áº§u.",
            )
          }
        />
      ) : (
        <>
          <div className="stats-grid">
            {cards.map(
              ({ title, icon: Icon, q, value, money: isMoney, sub, accent }) => (
                <section className={`stat-card${accent ? " " + accent : ""}`} key={title}>
                  <div className="stat-top">
                    <span>{title}</span>
                    <span className="stat-icon">
                      <Icon size={17} />
                    </span>
                  </div>
                  {q.isPending ? (
                    <Loading variant="field" />
                  ) : q.isError ? (
                    <ErrorState error={q.error} retry={() => q.refetch()} />
                  ) : (
                    <>
                      <strong className="stat-value">
                        {value == null
                          ? "â€”"
                          : isMoney
                            ? money(value)
                            : value.toLocaleString("vi-VN")}
                      </strong>
                      <small>
                        <span className="mini-dot" />
                        {sub}
                      </small>
                    </>
                  )}
                </section>
              ),
            )}
          </div>
          {!reports && (
            <section className="dashboard-callout">
              <CalendarDays size={28} />
              <div>
                <h2>Sáºµn sÃ ng cho lá»‹ch táº­p hÃ´m nay</h2>
                <p>Äiá»u phá»‘i phÃ²ng táº­p, lá»›p há»c vÃ  Ä‘á»™i ngÅ© huáº¥n luyá»‡n viÃªn.</p>
              </div>
              <Link className="button lime" to="/manager/schedules">
                Xem lá»‹ch hoáº¡t Ä‘á»™ng <ArrowUpRight size={18} />
              </Link>
            </section>
          )}
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">DÃ’NG TIá»€N</span>
                  <h2>Doanh thu theo phÆ°Æ¡ng thá»©c</h2>
                </div>
                <Wallet size={20} />
              </div>
              {revenue.isPending ? (
                <Loading variant="chart" />
              ) : revenue.isError ? (
                <ErrorState
                  error={revenue.error}
                  retry={() => revenue.refetch()}
                />
              ) : (
                <div className="chart-body">
                  <strong className="chart-total">
                    {money(revenue.data.data.totalRevenue)}
                  </strong>
                  <p>Tá»•ng doanh thu trong ká»³ Ä‘Ã£ chá»n</p>
                  <Bars values={revenue.data.data.revenueByMethod} currency />
                  <div className="chart-note">
                    <Activity size={15} />
                    Dá»¯ liá»‡u tá»« thanh toÃ¡n táº¡i trung tÃ¢m
                  </div>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Cá»˜NG Äá»’NG</span>
                  <h2>CÆ¡ cáº¥u há»™i viÃªn</h2>
                </div>
                <Users size={20} />
              </div>
              {members.isPending ? (
                <Loading variant="chart" />
              ) : members.isError ? (
                <ErrorState
                  error={members.error}
                  retry={() => members.refetch()}
                />
              ) : (
                <div className="chart-body">
                  <DistributionChart values={members.data.data.membersByTier} />
                  <div className="member-mini">
                    <div>
                      <strong>{members.data.data.newMembers}</strong>
                      <span>Há»™i viÃªn má»›i</span>
                    </div>
                    <div>
                      <strong>{members.data.data.activeMembers}</strong>
                      <span>CÃ²n hiá»‡u lá»±c</span>
                    </div>
                    <div>
                      <strong>{members.data.data.expiredMembers}</strong>
                      <span>Háº¿t háº¡n</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    {reports ? "Sá»¨C HÃšT Lá»šP Há»ŒC" : "NHá»ŠP Sá»NG TRUNG TÃ‚M"}
                  </span>
                  <h2>
                    {reports
                      ? "Lá»›p há»c Ä‘Æ°á»£c yÃªu thÃ­ch"
                      : "Lá»‹ch hoáº¡t Ä‘á»™ng hÃ´m nay"}
                  </h2>
                </div>
                <Link
                  className="text-link"
                  to={reports ? "/manager/classes" : "/manager/schedules"}
                >
                  Xem táº¥t cáº£ <MoveUpRight size={15} />
                </Link>
              </div>
              {reports ? (
                enrollments.isPending ? (
                  <Loading />
                ) : enrollments.isError ? (
                  <ErrorState
                    error={enrollments.error}
                    retry={() => enrollments.refetch()}
                  />
                ) : enrollments.data.data.topClasses.length ? (
                  <div className="chart-body">
                    {enrollments.data.data.topClasses.map((c, i) => (
                      <div className="ranking" key={c.classId}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <strong>{c.className}</strong>
                        <span className="badge">{c.count} lÆ°á»£t</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty text="ChÆ°a cÃ³ lÆ°á»£t Ä‘Äƒng kÃ½ trong ká»³" />
                )
              ) : schedule.isPending ? (
                <Loading />
              ) : schedule.isError ? (
                <ErrorState
                  error={schedule.error}
                  retry={() => schedule.refetch()}
                />
              ) : schedule.data.data.length ? (
                <div className="schedule-list">
                  {schedule.data.data.map((s) => (
                    <div className="schedule-item" key={String(s.id)}>
                      <span className="schedule-icon">
                        <Dumbbell size={21} />
                      </span>
                      <div>
                        <strong>
                          {display((s.class as RecordData)?.name)}
                        </strong>
                        <p>
                          {display((s.room as RecordData)?.name)} Â·{" "}
                          {display(s.startTime)}
                        </p>
                      </div>
                      <span className="badge">{display(s.status)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  text="HÃ´m nay chÆ°a cÃ³ lá»‹ch táº­p"
                  detail="Táº¡o lá»‹ch Ä‘á»ƒ báº¯t Ä‘áº§u má»™t ngÃ y Ä‘áº§y nÄƒng lÆ°á»£ng."
                />
              )}
            </section>
            <section className="quick-panel">
              <span className="eyebrow">Sáº´N SÃ€NG CHO BÆ¯á»šC TIáº¾P THEO?</span>
              <h2>
                Ãt thao tÃ¡c hÆ¡n.
                <br />
                Nhiá»u chuyá»ƒn Ä‘á»™ng hÆ¡n.
              </h2>
              <p>
                Nhá»¯ng cÃ´ng viá»‡c thÆ°á»ng ngÃ y,
                <br />
                chá»‰ cÃ¡ch báº¡n má»™t cháº¡m.
              </p>
              {[
                ["/manager/members", "Quáº£n lÃ½ há»™i viÃªn", Users],
                ["/manager/classes", "Tá»• chá»©c lá»›p há»c", Dumbbell],
                ["/manager/membership-plans", "Thiáº¿t láº­p gÃ³i táº­p", CreditCard],
              ].map(([to, title, Icon]) => {
                const I = Icon as typeof Users;
                return (
                  <Link key={String(to)} to={String(to)}>
                    <I size={18} />
                    <span>{String(title)}</span>
                    <ArrowUpRight size={18} />
                  </Link>
                );
              })}
            </section>
          </div>
          {reports && (
            <div className="dashboard-grid">
              {[
                [revenue, "Chi tiáº¿t thanh toÃ¡n"],
                [enrollments, "Chi tiáº¿t Ä‘Äƒng kÃ½ lá»›p"],
                [memberships, "Chi tiáº¿t gÃ³i thÃ nh viÃªn"],
              ].map(([raw, title]) => {
                const q = raw as typeof revenue;
                return (
                  <section className="panel" key={String(title)}>
                    <div className="panel-heading">
                      <h2>{String(title)}</h2>
                    </div>
                    {q.isPending ? (
                      <Loading variant="field" />
                    ) : q.isError ? (
                      <ErrorState error={q.error} retry={() => q.refetch()} />
                    ) : (
                      <div className="chart-body">
                        {Object.entries(q.data!.data)
                          .filter(([, v]) => typeof v === "number")
                          .map(([k, v]) => (
                            <div className="report-line" key={k}>
                              <span>{label(k)}</span>
                              <strong>
                                {k === "totalRevenue" ? money(v) : display(v)}
                              </strong>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
function Bars({
  values,
  currency = false,
}: {
  values: Record<string, number>;
  currency?: boolean;
}) {
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  return total === 0 ? (
    <Empty
      text="ChÆ°a cÃ³ dá»¯ liá»‡u trong ká»³"
      detail="Thá»­ chá»n má»™t khoáº£ng thá»i gian khÃ¡c."
    />
  ) : (
    <div className="bars">
      {Object.entries(values).map(([k, v], i) => (
        <div key={k}>
          <div className="bar-label">
            <span>
              <i className={"legend legend-" + i} />
              {label(k)}
            </span>
            <strong>{currency ? money(v) : v.toLocaleString("vi-VN")}</strong>
          </div>
          <div className="bar-track">
            <div
              className={"bar-fill fill-" + i}
              style={{ width: `${(100 * v) / total}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

