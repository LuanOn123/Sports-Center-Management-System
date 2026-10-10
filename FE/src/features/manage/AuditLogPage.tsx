import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, UserRound, Activity } from "lucide-react";
import { api, type RecordData } from "../../shared/api";
import { at, display, label } from "../../shared/config";
import { Details, Empty, ErrorState, Loading } from "../../shared/ui";
import "./admin.css";
const entities: Record<string, string> = {
  ClassSchedule: "Lịch học",
  Enrollment: "Đăng ký lớp",
  Class: "Lớp học",
  Room: "Phòng tập",
  FacilityStaff: "Phân công nhân sự",
  MembershipSubscription: "Gói hội viên",
  Payment: "Thanh toán",
  FacilityVisit: "Check-in",
  Facility: "Cơ sở",
};
const actions: Record<string, string> = {
  create: "Tạo mới",
  createMany: "Tạo nhiều",
  update: "Cập nhật",
  updateMany: "Cập nhật nhiều",
  delete: "Xóa",
  deleteMany: "Xóa nhiều",
  upsert: "Lưu thay đổi",
};
export function AuditLogPage({ role = "ADMIN" }: { role?: string }) {
  const [entity, setEntity] = useState(""),
    [filterFacilityId, setFacility] = useState(""),
    [skip, setSkip] = useState(0);
  const facilities = useQuery({
    queryKey: ["audit-facilities"],
    queryFn: ({ signal }) =>
      api<RecordData[]>("GET /facilities", {
        query: { includeInactive: "true" },
        signal,
      }),
    enabled: role === "ADMIN",
  });
  const q = useQuery({
    queryKey: ["audit-feed", entity, filterFacilityId, skip],
    queryFn: ({ signal }) =>
      api<RecordData[]>("GET /audit-logs", {
        query: { entity, filterFacilityId, skip: String(skip) },
        signal,
      }),
  });
  return (
    <div className="workflow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THEO DÕI VẬN HÀNH</div>
          <h1>Nhật ký hoạt động</h1>
          <p>Lịch được tạo, hội viên đăng ký và các thay đổi tại cơ sở.</p>
        </div>
      </div>
      <section className="panel">
        <div className="filters">
          <label>
            Hoạt động
            <select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value);
                setSkip(0);
              }}
            >
              <option value="">Tất cả hoạt động</option>
              {Object.entries(entities).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          {role === "ADMIN" && (
            <label>
              Cơ sở
              <select
                value={filterFacilityId}
                onChange={(e) => {
                  setFacility(e.target.value);
                  setSkip(0);
                }}
              >
                <option value="">Tất cả cơ sở</option>
                {facilities.data?.data.map((f) => (
                  <option key={String(f.id)} value={String(f.id)}>
                    {String(f.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="button"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            Làm mới
          </button>
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data.data.length ? (
          <Empty text="Chưa có hoạt động trong bộ lọc này" />
        ) : (
          <ol className="admin-audit-feed">
            {q.data.data.map((row) => {
              const after = row.after as RecordData | null,
                before = row.before as RecordData | null;
              const changed =
                after && before
                  ? Object.keys(after).filter(
                      (k) =>
                        !["updatedAt", "id", "facilityId"].includes(k) &&
                        JSON.stringify(after[k]) !== JSON.stringify(before[k]),
                    )
                  : [];
              return (
                <li key={String(row.id)}>
                  <span className="admin-audit-icon">
                    {row.entity === "ClassSchedule" ? (
                      <CalendarDays size={19} />
                    ) : row.entity === "Enrollment" ? (
                      <UserRound size={19} />
                    ) : (
                      <Activity size={19} />
                    )}
                  </span>
                  <div className="admin-audit-content">
                    <div className="admin-audit-title">
                      <strong>
                        {actions[String(row.action)] || display(row.action)} ·{" "}
                        {entities[String(row.entity)] || display(row.entity)}
                      </strong>
                      <time>{display(row.createdAt)}</time>
                    </div>
                    <p>
                      {String(
                        row.subject ||
                          after?.name ||
                          before?.name ||
                          "Thay đổi dữ liệu vận hành",
                      )}
                    </p>
                    <div className="admin-audit-meta">
                      <span>
                        {String(at(row, "actor.fullName") || "Hệ thống")}
                      </span>
                      <span>
                        {String(at(row, "facility.name") || "Toàn hệ thống")}
                      </span>
                      {row.sessionStart != null && (
                        <span>Buổi học: {display(row.sessionStart)}</span>
                      )}
                    </div>
                    {row.reason != null && <p>Lý do: {display(row.reason)}</p>}
                    {changed.length > 0 && (
                      <p className="field-note">
                        Đã thay đổi: {changed.map(label).join(", ")}
                      </p>
                    )}
                    <details>
                      <summary>Xem chi tiết thay đổi</summary>
                      <div className="admin-audit-diff">
                        {before && (
                          <div>
                            <h4>Trước thay đổi</h4>
                            <Details value={before} />
                          </div>
                        )}
                        {after && (
                          <div>
                            <h4>Sau thay đổi</h4>
                            <Details value={after} />
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div className="pagination">
          <span>Trang {skip / 100 + 1} · Tối đa 100 hoạt động mỗi trang</span>
          <div>
            <button
              className="button small"
              disabled={!skip || q.isFetching}
              onClick={() => setSkip(skip - 100)}
            >
              Trước
            </button>
            <button
              className="button small"
              disabled={q.data?.data.length !== 100 || q.isFetching}
              onClick={() => setSkip(skip + 100)}
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
