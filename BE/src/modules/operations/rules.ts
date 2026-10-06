export function mergeRequirements(rows: { key: string; minimum: number }[]) {
  const result: Record<string, number> = {};
  for (const row of rows)
    result[row.key] = Math.max(result[row.key] || 0, row.minimum);
  return result;
}
export function missingCapabilities(
  requirements: Record<string, number>,
  capabilities: { key: string; quantity: number }[],
) {
  const values = Object.fromEntries(
    capabilities.map((v) => [v.key, v.quantity]),
  );
  return Object.keys(requirements).filter(
    (key) => (values[key] || 0) < requirements[key],
  );
}
// SCMS currently operates in Vietnam; patterns use local dates and ISO weekdays.
export function expandPattern(
  start: string,
  end: string,
  weekdays: number[],
  startMinute: number,
  endMinute: number,
) {
  const first = new Date(`${start}T00:00:00Z`),
    last = new Date(`${end}T00:00:00Z`);
  if (
    isNaN(+first) ||
    isNaN(+last) ||
    first.toISOString().slice(0, 10) !== start ||
    last.toISOString().slice(0, 10) !== end ||
    last < first ||
    +last - +first > 366 * 86400000 ||
    startMinute < 0 ||
    endMinute > 1440 ||
    endMinute <= startMinute ||
    !weekdays.length ||
    weekdays.some((v) => v < 1 || v > 7)
  )
    throw new Error("Invalid schedule pattern");
  const dates = [];
  for (let date = +first; date <= +last; date += 86400000) {
    const day = new Date(date).getUTCDay() || 7;
    if (weekdays.includes(day))
      dates.push({
        startTime: new Date(date + (startMinute - 420) * 60000),
        endTime: new Date(date + (endMinute - 420) * 60000),
      });
  }
  if (!dates.length) throw new Error("Pattern produces no sessions");
  return dates;
}
