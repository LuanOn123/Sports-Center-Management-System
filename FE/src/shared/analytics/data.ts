import { api, type RecordData } from "../api";
import type { Datum } from "./Charts";
export function dayKey(value: unknown) {
  const d = new Date(String(value));
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d)
    : "";
}
export function daysAgo(day: string, count: number) {
  const d = new Date(`${day}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() - count);
  return dayKey(d);
}
export function daily(
  rows: RecordData[],
  field: string,
  start: string,
  end: string,
): Datum[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = dayKey(row[field]);
    if (day >= start && day <= end) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const result: Datum[] = [];
  for (
    let day = start;
    day <= end && result.length < 366;
    day = daysAgo(day, -1)
  )
    result.push({ label: day, value: counts.get(day) ?? 0 });
  return result;
}
export function group(
  rows: RecordData[],
  name: (row: RecordData) => string,
  identity = name,
): Datum[] {
  const values = new Map<string, Datum>();
  rows.forEach((row) => {
    const key = identity(row);
    const previous = values.get(key);
    values.set(key, { label: name(row), value: (previous?.value ?? 0) + 1 });
  });
  return [...values.values()].sort((a, b) => b.value - a.value);
}
export function nestedId(row: RecordData, key: string) {
  const value = row[key];
  return String(
    row[`${key}Id`] ||
      (value && typeof value === "object" && "id" in value
        ? value.id
        : nestedName(row, key)),
  );
}
export function nestedName(row: RecordData, key: string) {
  const value = row[key];
  return value && typeof value === "object" && "name" in value
    ? String(value.name)
    : "Chưa phân loại";
}
export async function dashboardRows(
  key: string,
  query: Record<string, string>,
  signal: AbortSignal,
) {
  const rows: RecordData[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = await api<RecordData[]>(key, {
      query: { ...query, page: String(page), limit: "100" },
      signal,
    });
    if (
      !Array.isArray(result.data) ||
      (result.pagination && result.pagination.page !== page)
    )
      throw new Error("Dữ liệu phân trang không hợp lệ.");
    rows.push(...result.data);
    if (!result.pagination || page >= result.pagination.totalPages) return rows;
  }
  throw new Error("Dữ liệu quá lớn. Vui lòng chọn khoảng thời gian ngắn hơn.");
}

/** All dimensions are counts, with a shared scale; dates use the VN business day. */
export function weekdays(
  rows: RecordData[],
  field: string,
  secondary: (row: RecordData) => boolean,
): Datum[] {
  const result = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => ({
    label,
    value: 0,
    secondary: 0,
  }));
  for (const row of rows) {
    const day = dayKey(row[field]);
    if (!day) continue;
    const index = (new Date(`${day}T12:00:00+07:00`).getUTCDay() + 6) % 7;
    result[index].value++;
    if (secondary(row)) result[index].secondary++;
  }
  return result;
}
