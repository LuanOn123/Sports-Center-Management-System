import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import type { FacilityLimits, FacilityUsage } from "../../shared/generated";
import { Loading, ErrorState } from "../../shared/ui";
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  facilityId: string;
  facilityName: string;
};

type MetricItem = {
  label: string;
  current: number;
  max: number | null;
  unit: string;
};

export function FacilityCapacityCard({ facilityId, facilityName }: Props) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["facility-limits", facilityId],
    queryFn: ({ signal }) =>
      api<{ limits: FacilityLimits; usage: FacilityUsage }>(
        `GET /facilities/${facilityId}/limits`,
        { signal },
      ),
  });

  if (isPending) return <Loading variant="field" />;
  if (isError) return <ErrorState error={error} retry={() => refetch()} />;

  const limits = data?.data?.limits;
  const usage = data?.data?.usage;

  if (!limits || !usage) return null;

  const metrics: MetricItem[] = [
    {
      label: "Lớp học đang mở",
      current: usage.activeClasses,
      max: limits.maxClasses,
      unit: "lớp",
    },
    {
      label: "Phòng tập",
      current: usage.activeRooms,
      max: limits.maxRooms,
      unit: "phòng",
    },
    {
      label: "Huấn luyện viên",
      current: usage.activeCoaches,
      max: limits.maxCoaches,
      unit: "HLV",
    },
    {
      label: "Hội viên hoạt động",
      current: usage.activeMembers,
      max: limits.maxMembers,
      unit: "người",
    },
    {
      label: "Môn thể thao",
      current: usage.activeSports,
      max: limits.maxSports,
      unit: "môn",
    },
  ];

  return (
    <article className="facility-capacity-card">
      <div className="facility-capacity-header">
        <h4>{facilityName}</h4>
        <span className="badge small">Định mức tài nguyên</span>
      </div>
      <div className="facility-capacity-metrics">
        {metrics.map((m) => {
          const hasLimit = m.max !== null && m.max !== undefined && m.max > 0;
          const pct = hasLimit ? Math.round((m.current / m.max!) * 100) : 0;

          let colorClass = "capacity-normal";
          let statusIcon = <CheckCircle2 size={13} className="text-success" />;
          let statusText = "Bình thường";

          if (hasLimit) {
            if (pct >= 100) {
              colorClass = "capacity-danger";
              statusIcon = <AlertCircle size={13} className="text-danger" />;
              statusText = "Đạt / Vượt giới hạn";
            } else if (pct >= 80) {
              colorClass = "capacity-warning";
              statusIcon = <AlertTriangle size={13} className="text-warning" />;
              statusText = "Sắp chạm ngưỡng";
            }
          }

          return (
            <div key={m.label} className="capacity-bar-group">
              <div className="capacity-bar-label">
                <span>{m.label}</span>
                <span className="capacity-numbers">
                  <strong>{m.current}</strong>
                  {hasLimit ? (
                    <> / {m.max} {m.unit} ({pct}%)</>
                  ) : (
                    <small> / Không giới hạn</small>
                  )}
                </span>
              </div>
              {hasLimit ? (
                <div className="capacity-track">
                  <div
                    className={`capacity-fill ${colorClass}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              ) : (
                <div className="capacity-track unlimited">
                  <div className="capacity-fill capacity-unlimited" style={{ width: "100%" }} />
                </div>
              )}
              {hasLimit && pct >= 80 && (
                <div className="capacity-alert-note">
                  {statusIcon}
                  <span>{statusText}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
