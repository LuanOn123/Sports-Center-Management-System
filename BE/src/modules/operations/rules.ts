export function mergeRequirements(rows: { key: string; minimum: number }[]) {
  const result: Record<string, number> = Object.create(null);
  for (const row of rows) {
    const key = row.key.trim().normalize("NFC").toLocaleLowerCase("vi");
    result[key] = Math.max(result[key] || 0, row.minimum);
  }
  return result;
}
/**
 * AUD-10: điều kiện phòng của lớp lấy từ snapshot đóng băng lúc tạo/cập nhật môn của lớp
 * (BR-ROOM-02). Chỉ fallback sang yêu cầu live của môn khi lớp cũ chưa có snapshot.
 */
export function classRequirements(cls: {
  requirementsSnapshot?: unknown;
  sports?: { requirements?: { key: string; minimum: number }[] }[];
}) {
  const snapshot = cls.requirementsSnapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    return mergeRequirements(
      Object.entries(snapshot as Record<string, unknown>)
        .filter(([, minimum]) => typeof minimum === "number")
        .map(([key, minimum]) => ({ key, minimum: minimum as number })),
    );
  }
  return mergeRequirements((cls.sports ?? []).flatMap((sport) => sport.requirements ?? []));
}
/**
 * AUD-06: tập HLV thực sự dạy một buổi — nguồn duy nhất cho điểm danh, roster, duyệt nghỉ.
 * Buổi có HLV thay (`schedule.coachId`) ⇒ người thay THAY CHO HLV chính, HLV phụ vẫn dạy.
 */
export function effectiveCoachIds(
  scheduleCoachId: string | null | undefined,
  classCoaches: { coachId: string; isPrimary: boolean }[],
) {
  if (!scheduleCoachId) return [...new Set(classCoaches.map((c) => c.coachId))];
  return [...new Set([scheduleCoachId, ...classCoaches.filter((c) => !c.isPrimary).map((c) => c.coachId)])];
}
export function missingCapabilities(
  requirements: Record<string, number>,
  capabilities: { key: string; quantity: number }[],
  areaType = "INDOOR",
) {
  if (areaType !== "INDOOR") return [];
  const requiresEquipment = Object.values(requirements).some((minimum) => minimum > 0);
  return requiresEquipment && !capabilities.some((row) => row.quantity > 0) ? ["Dụng cụ tập luyện"] : [];
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
