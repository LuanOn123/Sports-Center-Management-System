import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
vi.mock("../src/shared/pagedApi", () => ({ allPages: vi.fn() }));
import { api } from "../src/shared/api";
import { allPages } from "../src/shared/pagedApi";
import { assertCoachCanTeach, canTeach, classSportIds, loadQualifiedCoaches } from "../src/shared/coachEligibility";
beforeEach(() => vi.resetAllMocks());

it("requires all class sports, never treats an unassigned coach or unclassified class as eligible", () => {
  expect(canTeach(["yoga"], ["yoga"])).toBe(true);
  expect(canTeach(["yoga"], ["swim"])).toBe(false);
  expect(canTeach(["yoga"], [])).toBe(false);
  expect(canTeach([], ["yoga"])).toBe(false);
  expect(canTeach([""], [""])).toBe(false);
  expect(canTeach(["yoga", "swim"], ["yoga"])).toBe(false);
  expect(canTeach(["yoga", "swim"], ["swim", "yoga", "tennis"])).toBe(true);
});

it("uses profile IDs and assigned sports instead of specialization descriptions", async () => {
  vi.mocked(allPages).mockResolvedValue({ success: true, message: "", data: [
    { id: "user1", fullName: "An", coachProfile: { id: "profile1", specialization: "Swimming" } },
    { id: "user2", fullName: "Inactive", isActive: false, coachProfile: { id: "profile2" } },
    { id: "user3", fullName: "No profile" },
  ] });
  vi.mocked(api).mockResolvedValue({ success: true, message: "", data: [{ sportId: "yoga" }] });
  expect(await loadQualifiedCoaches()).toEqual([{ id: "profile1", name: "An", sportIds: ["yoga"] }]);
  expect(api).toHaveBeenCalledExactlyOnceWith("GET /coaches/{id}/specializations", { params: { id: "profile1" }, signal: undefined });
});

it("fails closed if qualification data cannot be loaded", async () => {
  vi.mocked(allPages).mockResolvedValue({ success: true, message: "", data: [{ coachProfile: { id: "p1" } }] });
  vi.mocked(api).mockRejectedValue(new Error("Network error"));
  await expect(loadQualifiedCoaches()).rejects.toThrow("Network error");
});

it("revalidates current qualification and rejects a stale selection", async () => {
  vi.mocked(api).mockResolvedValue({ success: true, message: "", data: [{ sportId: "swim" }] });
  await expect(assertCoachCanTeach("p1", ["yoga"])).rejects.toThrow("HLV chỉ được dạy");
  await expect(assertCoachCanTeach("p1", ["swim"])).resolves.toBeUndefined();
});

it("rejects missing class sports rather than allowing unrestricted assignment", async () => {
  vi.mocked(api).mockResolvedValue({ success: true, message: "", data: { sports: [] } });
  await expect(classSportIds("c1")).rejects.toThrow("Chưa xác định được bộ môn");
});
