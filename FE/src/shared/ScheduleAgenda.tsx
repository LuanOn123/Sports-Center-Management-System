import type { ReactNode } from "react";
import { MapPin, Clock3 } from "lucide-react";
import type { RecordData } from "./api";
import { at, display } from "./config";
import { Empty } from "./feedback";
import { StatusBadge } from "./StatusBadge";

function date(value: unknown, options: Intl.DateTimeFormatOptions) {
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN", options);
}

export function ScheduleAgenda({
  rows,
  selectedId,
  actions,
}: {
  rows: RecordData[];
  selectedId?: string;
  actions: (row: RecordData) => ReactNode;
}) {
  if (!rows.length)
    return (
      <Empty
        text="Chưa có lịch học"
        detail="Thử chọn ngày khác hoặc thay đổi bộ lọc."
      />
    );
  return (
    <div className="agenda-list">
      {rows.map((row) => (
        <article
          className={`agenda-item ${String(row.id) === selectedId ? "is-selected" : ""}`}
          key={String(row.id)}
        >
          <div className="agenda-date">
            <strong>{date(row.startTime, { day: "2-digit" })}</strong>
            <span>
              {date(row.startTime, { month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="agenda-info">
            <div className="agenda-title">
              <h3>{display(at(row, "class.name"))}</h3>
              <StatusBadge value={row.status} />
            </div>
            <p>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                {date(row.startTime, {
                  hour: "2-digit",
                  minute: "2-digit",
                })} –{" "}
                {date(row.endTime, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>
                <MapPin size={15} aria-hidden="true" />
                {display(at(row, "room.name"))}
              </span>
            </p>
          </div>
          <div className="agenda-actions">{actions(row)}</div>
        </article>
      ))}
    </div>
  );
}
