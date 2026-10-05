import { label } from "./config";
import { Empty } from "./feedback";
const colors = [
  "var(--chart-1, #254b3d)",
  "var(--chart-2, #b8d992)",
  "var(--chart-3, #dec5a4)",
  "var(--chart-4, #8aabc1)",
];
export function DistributionChart({
  values,
}: {
  values: Record<string, number>;
}) {
  const entries = Object.entries(values).filter(
    ([, value]) => Number.isFinite(value) && value >= 0,
  );
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total)
    return (
      <Empty
        text="Chưa có dữ liệu trong kỳ"
        detail="Thử chọn một khoảng thời gian khác."
      />
    );
  let position = 0;
  const segments = entries.map(([, value], index) => {
    const start = position;
    position += (value / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${position}%`;
  });
  return (
    <div className="distribution-chart">
      <div
        className="distribution-ring"
        style={{ background: `conic-gradient(${segments.join(",")})` }}
        aria-hidden="true"
      >
        <div>
          <strong>{total.toLocaleString("vi-VN")}</strong>
          <span>Hội viên</span>
        </div>
      </div>
      <ul aria-label="Cơ cấu hội viên theo hạng">
        {entries.map(([key, value], index) => (
          <li key={key}>
            <span
              className="distribution-swatch"
              style={{ background: colors[index % colors.length] }}
              aria-hidden="true"
            />
            <span>{label(key)}</span>
            <strong>{value.toLocaleString("vi-VN")}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
