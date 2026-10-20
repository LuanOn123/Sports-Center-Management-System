import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});

describe("Schedule Shifts Configuration (7:00 to 21:00, 2-hour shifts)", () => {
  it("should have exactly 7 shifts spanning 07:00 to 21:00", async () => {
    const { SCHEDULE_SHIFTS } = await import("../src/features/manage/ScheduleForm");
    expect(SCHEDULE_SHIFTS).toHaveLength(7);
    expect(SCHEDULE_SHIFTS[0].startTime).toBe("07:00");
    expect(SCHEDULE_SHIFTS[SCHEDULE_SHIFTS.length - 1].endTime).toBe("21:00");
  });

  it("each shift should be exactly 2 hours long", async () => {
    const { SCHEDULE_SHIFTS } = await import("../src/features/manage/ScheduleForm");
    for (const shift of SCHEDULE_SHIFTS) {
      const [startHour, startMin] = shift.startTime.split(":").map(Number);
      const [endHour, endMin] = shift.endTime.split(":").map(Number);
      const startInMinutes = startHour * 60 + startMin;
      const endInMinutes = endHour * 60 + endMin;
      expect(endInMinutes - startInMinutes).toBe(120);
    }
  });

  it("shifts should be continuous from 07:00 to 21:00", async () => {
    const { SCHEDULE_SHIFTS } = await import("../src/features/manage/ScheduleForm");
    for (let i = 0; i < SCHEDULE_SHIFTS.length - 1; i++) {
      expect(SCHEDULE_SHIFTS[i].endTime).toBe(SCHEDULE_SHIFTS[i + 1].startTime);
    }
  });

  it("shift labels should match the expected format", async () => {
    const { SCHEDULE_SHIFTS } = await import("../src/features/manage/ScheduleForm");
    expect(SCHEDULE_SHIFTS.map((s) => s.label)).toEqual([
      "07:00 – 09:00",
      "09:00 – 11:00",
      "11:00 – 13:00",
      "13:00 – 15:00",
      "15:00 – 17:00",
      "17:00 – 19:00",
      "19:00 – 21:00",
    ]);
  });
});
