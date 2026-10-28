import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { getFacilityId } from "../../shared/facility";
import { ErrorState, Loading } from "../../shared/ui";
import {
  MembershipUsageReport,
  type MembershipUsageReportData,
} from "./MembershipUsageReport";

type Term = {
  id: string;
  name: string;
  registrationStartDate: string;
  registrationEndDate: string;
};
export function MembershipInsightsPage({
  global = false,
}: {
  global?: boolean;
}) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const [startDate, setStart] = useState(today.slice(0, 7) + "-01");
  const [endDate, setEnd] = useState(today);
  const [termId, setTerm] = useState("");
  const facilityId = getFacilityId();
  const terms = useQuery({
    queryKey: ["insight-terms", facilityId],
    queryFn: ({ signal }) => allPages<Term>("GET /terms", { signal }),
  });
  const valid = Boolean(startDate && endDate && startDate <= endDate);
  const report = useQuery({
    queryKey: [
      "membership-insights",
      global ? "ALL" : facilityId,
      startDate,
      endDate,
      termId,
    ],
    queryFn: ({ signal }) =>
      api<MembershipUsageReportData>("GET /reports/memberships", {
        query: {
          startDate,
          endDate,
          ...(global ? { facilityId: "ALL" } : {}),
          ...(termId ? { termId } : {}),
        },
        signal,
      }),
    enabled: valid,
  });
  return (
    <div className="workflow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NHU CẦU TẬP LUYỆN</span>
          <h1>Nhu cầu gói & lớp</h1>
          <p>
            {global
              ? "Theo dõi toàn hệ thống"
              : "Theo dõi tại cơ sở đang quản lý"}{" "}
            để chuẩn bị gói tập và lớp học cho kỳ tiếp theo.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="filters membership-usage-body">
          <label>
            Kỳ học
            <select
              value={termId}
              disabled={terms.isPending || terms.isError}
              onChange={(event) => {
                setTerm(event.target.value);
                const term = terms.data?.data.find(
                  (row) => row.id === event.target.value,
                );
                if (term) {
                  setStart(
                    new Date(term.registrationStartDate).toLocaleDateString(
                      "en-CA",
                      { timeZone: "Asia/Ho_Chi_Minh" },
                    ),
                  );
                  setEnd(
                    new Date(term.registrationEndDate).toLocaleDateString(
                      "en-CA",
                      { timeZone: "Asia/Ho_Chi_Minh" },
                    ),
                  );
                }
              }}
            >
              <option value="">Tất cả kỳ học</option>
              {terms.data?.data.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Từ ngày đăng ký
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label>
            Đến ngày đăng ký
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={!valid || report.isFetching}
            onClick={() => report.refetch()}
          >
            Làm mới
          </button>
        </div>
        {terms.error && (
          <ErrorState error={terms.error} retry={() => terms.refetch()} />
        )}
      </section>
      {!valid ? (
        <p role="alert">Chọn khoảng ngày hợp lệ.</p>
      ) : report.isPending ? (
        <Loading />
      ) : report.error ? (
        <ErrorState error={report.error} retry={() => report.refetch()} />
      ) : (
        <MembershipUsageReport data={report.data?.data} />
      )}
    </div>
  );
}
