import type { ReactNode } from "react";
import type { RecordData } from "../api";
import { Card, Columns, Gauge, Kpi, Ranking, Timeline, Radar } from "./Charts";
import { daily, group, nestedName, nestedId, weekdays } from "./data";
export function ScheduleAnalytics({
  rows,
  start,
  end,
  coach = false,
  summary,
}: {
  rows: RecordData[];
  start: string;
  end: string;
  coach?: boolean;
  summary?: ReactNode;
}) {
  const active = rows.filter((r) => r.status !== "CANCELLED");
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const cancelled = rows.length - active.length;
  const classes = group(
    active,
    (r) => nestedName(r, "class"),
    (r) => nestedId(r, "class"),
  );
  const rooms = group(
    active,
    (r) => nestedName(r, "room"),
    (r) => nestedId(r, "room"),
  );
  return (
    <div className="analytics-dashboard">
      <div className="analytics-layout">
        <div className="analytics-main">
          <div className="analytics-kpis">
            <Kpi
              title="Buổi trong kỳ"
              value={rows.length}
              note="Gồm buổi đã hủy"
            />
            <Kpi
              title="Đã hoàn thành"
              value={completed}
              note="Tỷ lệ trên buổi không hủy"
              part={completed}
              total={active.length}
            />
            <Kpi
              title="Đã lên lịch"
              value={rows.filter((r) => r.status === "SCHEDULED").length}
              note="Tỷ lệ trên tất cả buổi"
              part={rows.filter((r) => r.status === "SCHEDULED").length}
              total={rows.length}
            />
            <Kpi
              title="Đã hủy"
              value={cancelled}
              note="Tỷ lệ trên tất cả buổi"
              part={cancelled}
              total={rows.length}
            />
          </div>

          <Card
            title={coach ? "Nhịp giảng dạy" : "Nhịp hoạt động cơ sở"}
            note={`${start} — ${end} · Số buổi theo ngày bắt đầu (GMT+7), không gồm buổi hủy.`}
          >
            <Timeline
              data={daily(active, "startTime", start, end)}
              title="Buổi học"
            />
          </Card>
          <div className="analytics-analysts">
            <Card
              title="Phân tích lớp học"
              note="Xếp hạng theo số buổi không hủy trong kỳ, tối đa 6 lớp."
            >
              <Ranking data={classes.slice(0, 6)} />
            </Card>
            <Card
              title="Phân bổ phòng tập"
              note="Số buổi theo phòng, tối đa 6 phòng. Không phải tỷ lệ sử dụng công suất."
            >
              <Columns data={rooms.slice(0, 6)} primary="Buổi học" />
            </Card>
          </div>
        </div>
        <aside className="analytics-side">
          <Card
            title="Nhịp hoạt động theo thứ"
            note="Số buổi trong kỳ, cộng theo thứ trong tuần."
          >
            <Columns
              data={weekdays(
                active,
                "startTime",
                (r) => r.status === "COMPLETED",
              )}
              primary="Không hủy"
              secondary="Hoàn thành"
              variant="lollipop"
            />
          </Card>
          <Card
            title="Phân bố lịch trong tuần"
            note="Cùng thang đo số buổi; không phải điểm hiệu suất."
          >
            <Radar
              data={weekdays(
                active,
                "startTime",
                (r) => r.status === "COMPLETED",
              )}
              primary="Không hủy"
              secondary="Hoàn thành"
            />
          </Card>
          {summary ?? (
            <Card title="Tóm tắt hoạt động">
              <dl className="analytics-summary">
                <div>
                  <dt>Lớp có lịch</dt>
                  <dd>{classes.length}</dd>
                </div>
                <div>
                  <dt>Phòng có lịch</dt>
                  <dd>{rooms.length}</dd>
                </div>
                <div>
                  <dt>Buổi không hủy</dt>
                  <dd>{active.length}</dd>
                </div>
              </dl>
            </Card>
          )}
          <Card title="Tiến độ trong kỳ">
            <Gauge
              part={completed}
              total={active.length}
              label="Buổi đã hoàn thành / không hủy"
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
