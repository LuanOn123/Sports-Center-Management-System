import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Empty } from "../feedback";
import "./analytics.css";

export type Datum = { label: string; value: number; secondary?: number };
export const number = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })
    : "—";
export function Card({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel analytics-card ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {note && (
            <details className="analytics-note">
              <summary aria-label={`Giải thích: ${title}`}>ⓘ</summary>
              <p>{note}</p>
            </details>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
export function Kpi({
  title,
  value,
  note,
  part,
  total,
}: {
  title: string;
  value: ReactNode;
  note: string;
  part?: number;
  total?: number;
}) {
  const ratio =
    total != null &&
    Number.isFinite(total) &&
    total > 0 &&
    part != null &&
    Number.isFinite(part) &&
    part >= 0 &&
    part <= total
      ? part / total
      : null;
  return (
    <section className="panel analytics-kpi">
      <span className="analytics-kpi-title">{title}</span>
      <div className="analytics-kpi-body">
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="28" className="analytics-ring-track" />
          <circle
            style={{
              visibility: ratio != null && ratio > 0 ? "visible" : "hidden",
            }}
            cx="36"
            cy="36"
            r="28"
            className="analytics-ring-value"
            strokeDasharray={`${(ratio ?? 0) * 176} 176`}
            transform="rotate(-90 36 36)"
          />
          <text x="36" y="40" textAnchor="middle">
            {ratio === null ? "Σ" : `${Math.round(ratio * 100)}%`}
          </text>
        </svg>
        <strong>{value}</strong>
      </div>
      <div className="analytics-kpi-caption">
        <small>{note}</small>
        {ratio !== null && (
          <span className="sr-only">{number(ratio * 100)}%</span>
        )}
      </div>
    </section>
  );
}
export function Ranking({
  data,
  format = number,
}: {
  data: Datum[];
  format?: (value: number) => string;
}) {
  const rows = data
    .filter((d) => Number.isFinite(d.value))
    .slice()
    .sort((a, b) => b.value - a.value);
  const max = Math.max(0, ...rows.map((d) => Math.abs(d.value)));
  if (!max) return <Empty text="Chưa có dữ liệu trong kỳ" />;
  return (
    <ol className="analytics-ranking">
      {rows.map((d, i) => (
        <li key={`${d.label}-${i}`}>
          <div>
            <span>{d.label}</span>
            <strong>{format(d.value)}</strong>
          </div>
          <div className="analytics-track">
            <span
              style={{
                width: `${(Math.abs(d.value) / max) * 100}%`,
                background: `var(--chart-${(i % 4) + 1})`,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
export function Columns({
  data,
  primary,
  secondary,
  variant = "bar",
}: {
  data: Datum[];
  primary: string;
  secondary?: string;
  variant?: "bar" | "lollipop";
}) {
  const max = Math.max(0, ...data.flatMap((d) => [d.value, d.secondary ?? 0]));
  if (!max) return <Empty text="Chưa có dữ liệu trong kỳ" />;
  return (
    <div className={`analytics-columns analytics-columns-${variant}`}>
      <div className="analytics-legend">
        <span>{primary}</span>
        {secondary && <span>{secondary}</span>}
      </div>
      <div className="analytics-column-grid">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="analytics-column">
            <div className="analytics-column-bars">
              <div>
                <strong>{number(d.value)}</strong>
                <span
                  title={`${d.label} · ${primary}: ${number(d.value)}`}
                  style={{
                    height: `calc(var(--analytics-bar-size, 112px) * ${d.value / max})`,
                  }}
                />
              </div>
              {secondary && (
                <div>
                  <strong>{number(d.secondary ?? 0)}</strong>
                  <span
                    title={`${d.label} · ${secondary}: ${number(d.secondary ?? 0)}`}
                    style={{
                      height: `calc(var(--analytics-bar-size, 112px) * ${(d.secondary ?? 0) / max})`,
                    }}
                  />
                </div>
              )}
            </div>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
      {variant === "lollipop" && (
        <details>
          <summary>Xem số liệu</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th>{primary}</th>
                  {secondary && <th>{secondary}</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={`${d.label}-${i}`}>
                    <td>{d.label}</td>
                    <td>{number(d.value)}</td>
                    {secondary && <td>{number(d.secondary ?? 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
export function Gauge({
  part,
  total,
  label,
}: {
  part: number;
  total: number;
  label: string;
}) {
  if (!total) return <Empty text="Chưa có dữ liệu để tính tỷ lệ" />;
  const ratio = Math.max(0, Math.min(1, part / total));
  return (
    <div className="analytics-gauge">
      <svg viewBox="0 0 160 115" aria-hidden="true">
        <path
          d="M15 80 A65 65 0 0 1 145 80"
          className="analytics-ring-track"
          pathLength="100"
        />
        <path
          d="M15 80 A65 65 0 0 1 145 80"
          className="analytics-ring-value"
          pathLength="100"
          strokeDasharray={`${ratio * 100} 100`}
        />
        <path
          d="M77 80 L80 29 L83 80 Z"
          className="analytics-needle"
          transform={`rotate(${ratio * 180 - 90} 80 80)`}
        />
        <circle cx="80" cy="80" r="4" className="analytics-needle" />
        <text x="80" y="108" textAnchor="middle">
          {number(ratio * 100)}%
        </text>
      </svg>
      <strong>{label}</strong>
      <p>
        {number(part)} / {number(total)}
      </p>
    </div>
  );
}
export function Timeline({
  data,
  title,
  format = number,
}: {
  data: Datum[];
  title: string;
  format?: (value: number) => string;
}) {
  const fillId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [plotHeight, setPlotHeight] = useState(320);
  const populated = data.length > 0 && data.some((d) => d.value !== 0);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect.width;
      if (size) setWidth(Math.max(180, size));
      const height = entries[0]?.contentRect.height;
      if (height) setPlotHeight(Math.max(100, height));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [populated]);
  if (!populated)
    return (
      <Empty
        text="Chưa có dữ liệu trong kỳ"
        detail="Thử chọn khoảng thời gian khác."
      />
    );
  const height = plotHeight,
    left = width < 500 ? 36 : 60,
    bottom = height - 38;
  const max = Math.max(
    4,
    Math.ceil(Math.max(...data.map((d) => d.value)) / 4) * 4,
  );
  const x = (i: number) =>
    left + (i / Math.max(1, data.length - 1)) * (width - left - 24);
  const y = (v: number) => bottom - (v / max) * (bottom - 26);
  const line = data
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`)
    .join(" ");
  const active = hover === null ? null : data[hover];
  return (
    <div className="analytics-timeline">
      <dl className="analytics-market-stats">
        <div>
          <dt>Tổng trong kỳ</dt>
          <dd>{format(data.reduce((sum, d) => sum + d.value, 0))}</dd>
        </div>
        <div>
          <dt>Cao nhất / ngày</dt>
          <dd>{format(Math.max(...data.map((d) => d.value)))}</dd>
        </div>
        <div>
          <dt>Trung bình / ngày</dt>
          <dd>
            {format(data.reduce((sum, d) => sum + d.value, 0) / data.length)}
          </dd>
        </div>
      </dl>
      <div className="analytics-readout" role="status">
        {active
          ? `${active.label} · ${format(active.value)}`
          : "Di chuột hoặc dùng Tab để xem từng mốc"}
      </div>
      <div className="analytics-plot" ref={container}>
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity=".32" />
              <stop
                offset="100%"
                stopColor="var(--chart-1)"
                stopOpacity=".02"
              />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((t) => (
            <g key={t}>
              <line
                x1={left}
                x2={width - 24}
                y1={y((max * t) / 4)}
                y2={y((max * t) / 4)}
                className="analytics-grid-line"
              />
              <text x={left - 8} y={y((max * t) / 4) + 4} textAnchor="end">
                {new Intl.NumberFormat("vi-VN", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format((max * t) / 4)}
              </text>
            </g>
          ))}
          <path
            d={`${line} L${x(data.length - 1)},${bottom} L${left},${bottom} Z`}
            className="analytics-area"
            style={{ fill: `url(#${fillId})` }}
          />
          <path d={line} className="analytics-line" />
          {hover !== null && data[hover] && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={20}
              y2={bottom}
              className="analytics-crosshair"
            />
          )}
          {data.map((d, i) => (
            <g key={`${d.label}-${i}`}>
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r="4"
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${format(d.value)}`}
                className="analytics-point"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <title>
                  {d.label}: {format(d.value)}
                </title>
              </circle>
              {(i === 0 ||
                i === data.length - 1 ||
                (width < 500
                  ? i === Math.floor((data.length - 1) / 2)
                  : i % Math.ceil(data.length / 5) === 0)) && (
                <text x={x(i)} y={height - 10} textAnchor="middle">
                  {d.label.slice(5).split("-").reverse().join("/")}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <details className="analytics-data-table">
        <summary>Xem bảng số liệu</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>{title}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td>{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function Radar({
  data,
  primary,
  secondary,
}: {
  data: Datum[];
  primary: string;
  secondary: string;
}) {
  const max = Math.max(0, ...data.flatMap((d) => [d.value, d.secondary ?? 0]));
  if (data.length < 3 || !max)
    return <Empty text="Chưa đủ dữ liệu để so sánh" />;
  const point = (i: number, radius: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / data.length;
    return [140 + Math.cos(angle) * radius, 125 + Math.sin(angle) * radius];
  };
  const polygon = (ratio: number) =>
    data.map((_, i) => point(i, 78 * ratio).join(",")).join(" ");
  return (
    <div className="analytics-radar">
      <div className="analytics-legend">
        <span>{primary}</span>
        <span>{secondary}</span>
      </div>
      <svg
        viewBox="0 0 280 250"
        role="img"
        aria-label={`${primary} và ${secondary}, cùng thang đo từ 0 đến ${max}`}
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={polygon(ratio)}
            className="analytics-radar-grid"
          />
        ))}
        {data.map((d, i) => {
          const end = point(i, 78),
            text = point(i, 103);
          return (
            <g key={d.label}>
              <line
                x1="140"
                y1="125"
                x2={end[0]}
                y2={end[1]}
                className="analytics-grid-line"
              />
              <text
                x={text[0]}
                y={text[1]}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
        <polygon
          points={data
            .map((d, i) => point(i, (d.value / max) * 78).join(","))
            .join(" ")}
          className="analytics-radar-primary"
        />
        <polygon
          points={data
            .map((d, i) => point(i, ((d.secondary ?? 0) / max) * 78).join(","))
            .join(" ")}
          className="analytics-radar-secondary"
        />
      </svg>
      <details>
        <summary>Xem so sánh theo thứ</summary>
        <dl className="analytics-summary">
          {data.map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>
                {number(d.value)} / {number(d.secondary ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
