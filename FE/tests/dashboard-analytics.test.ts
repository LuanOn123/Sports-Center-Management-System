import { describe, expect, it, vi, beforeEach } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("../src/shared/api", () => ({ api: request }));
import {
  daily,
  weekdays,
  dayKey,
  group,
  nestedId,
  nestedName,
  dashboardRows,
} from "../src/shared/analytics/data";
describe("dashboard analytics data", () => {
  it("radar uses real weekday counts and a subset on the same scale", () => {
    const result = weekdays(
      [
        { startTime: "2026-10-08T17:00:00Z", status: "COMPLETED" },
        { startTime: "2026-10-09T03:00:00Z", status: "SCHEDULED" },
        {},
      ],
      "startTime",
      (row) => row.status === "COMPLETED",
    );
    expect(result[4]).toEqual({ label: "T6", value: 2, secondary: 1 });
    expect(result.reduce((sum, row) => sum + row.value, 0)).toBe(2);
  });
  beforeEach(() => request.mockReset());
  it("groups by Vietnamese business date and fills missing dates", () => {
    expect(dayKey("2026-10-08T17:00:00Z")).toBe("2026-10-09");
    expect(
      daily(
        [
          { createdAt: "2026-10-08T17:00:00Z" },
          { createdAt: "2026-10-10T17:00:00Z" },
        ],
        "createdAt",
        "2026-10-08",
        "2026-10-10",
      ),
    ).toEqual([
      { label: "2026-10-08", value: 0 },
      { label: "2026-10-09", value: 1 },
      { label: "2026-10-10", value: 0 },
    ]);
  });
  it("does not count missing timestamps as activity today", () => {
    expect(dayKey(undefined)).toBe("");
    expect(daily([{}], "createdAt", "2026-10-09", "2026-10-09")).toEqual([
      { label: "2026-10-09", value: 0 },
    ]);
  });
  it("keeps different classes with the same name separate", () => {
    const rows = [
      { classId: "a", class: { name: "Yoga" } },
      { classId: "b", class: { name: "Yoga" } },
      { classId: "a", class: { name: "Yoga" } },
    ];
    expect(
      group(
        rows,
        (r) => nestedName(r, "class"),
        (r) => nestedId(r, "class"),
      ).map((d) => d.value),
    ).toEqual([2, 1]);
  });
  it("fetches all pages using the same date range", async () => {
    request
      .mockResolvedValueOnce({
        data: [{ id: "1" }],
        pagination: { page: 1, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: "2" }],
        pagination: { page: 2, totalPages: 2 },
      });
    const signal = new AbortController().signal;
    expect(
      await dashboardRows("GET /payments", { startDate: "2026-10-01" }, signal),
    ).toEqual([{ id: "1" }, { id: "2" }]);
    expect(request.mock.calls[1][1]).toEqual({
      query: { startDate: "2026-10-01", page: "2", limit: "100" },
      signal,
    });
  });
  it("rejects repeated pages instead of displaying partial totals", async () => {
    request.mockResolvedValue({
      data: [{ id: "1" }],
      pagination: { page: 1, totalPages: 2 },
    });
    await expect(
      dashboardRows("GET /payments", {}, new AbortController().signal),
    ).rejects.toThrow("Dữ liệu phân trang");
  });
});
