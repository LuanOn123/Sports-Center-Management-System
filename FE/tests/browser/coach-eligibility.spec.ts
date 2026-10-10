import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function fixture(page: Page, sportIds = ["yoga"]) {
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.message, error.stack));
  await setup(page, "MANAGER");
  const state = { revoked: false, broken: false, writes: [] as { path: string; body: unknown }[] };
  const cls = { id: "class1", name: "Lớp chuyên môn", isActive: true, areaType: "INDOOR", capacity: 20, sports: sportIds.map((id) => ({ id, name: id })), coaches: [] };
  const coaches = [
    { id: "user1", fullName: "HLV Yoga", coachProfile: { id: "p1", specialization: "Bơi" } },
    { id: "user2", fullName: "HLV Bơi", coachProfile: { id: "p2", specialization: "Yoga" } },
    { id: "user3", fullName: "HLV Đa môn", coachProfile: { id: "p3" } },
    { id: "user4", fullName: "HLV Chưa gán", coachProfile: { id: "p4" } },
  ];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (request.method() === "POST" && path.startsWith("/classes/class1/coaches")) {
      state.writes.push({ path, body: request.postDataJSON() }); data = {};
    } else if (path === "/classes") data = [cls];
    else if (path === "/classes/class1") data = cls;
    else if (path === "/coaches") data = coaches;
    else if (/^\/coaches\/p\d\/specializations$/.test(path)) {
      if (state.broken) return route.fulfill({ status: 503, json: { success: false, message: "Không thể tải bộ môn" } });
      const id = path.split("/")[2];
      data = (id === "p1" ? (state.revoked ? ["swim"] : ["yoga"]) : id === "p2" ? ["swim"] : id === "p3" ? ["yoga", "swim"] : []).map((sportId) => ({ sportId }));
    } else return route.fallback();
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}

for (const support of [false, true]) {
  test(`filters ${support ? "support" : "main"} assignment by authorized sports and sends the profile ID`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto("/manager/classes");
    await page.getByRole("button", { name: support ? "Phân công huấn luyện viên hỗ trợ" : "Phân công huấn luyện viên", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const select = dialog.getByLabel("Huấn luyện viên", { exact: true });
    await expect(select.locator("option")).toHaveText(["Chọn HLV phù hợp", "HLV Yoga", "HLV Đa môn"]);
    await select.selectOption("p1");
    await dialog.getByRole("button", { name: "Phân công", exact: true }).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0]).toEqual({ path: `/classes/class1/coaches${support ? "/support" : ""}`, body: support ? { coachId: "p1" } : { coachId: "p1", isPrimary: true } });
  });
}

test("multi-sport classes require every sport to be assigned", async ({ page }) => {
  await fixture(page, ["yoga", "swim"]);
  await page.goto("/manager/classes");
  await page.getByRole("button", { name: "Phân công huấn luyện viên", exact: true }).click();
  await expect(page.getByRole("dialog").locator("select option")).toHaveText(["Chọn HLV phù hợp", "HLV Đa môn"]);
});

test("qualification revoked after opening the form prevents the assignment request", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/manager/classes");
  await page.getByRole("button", { name: "Phân công huấn luyện viên", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Huấn luyện viên", { exact: true }).selectOption("p1");
  state.revoked = true;
  await dialog.getByRole("button", { name: "Phân công", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("HLV chỉ được dạy");
  expect(state.writes).toEqual([]);
});

test("unclassified classes cannot assign a coach", async ({ page }) => {
  await fixture(page, []);
  await page.goto("/manager/classes");
  await page.getByRole("button", { name: "Phân công huấn luyện viên", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Chưa xác định được bộ môn");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Phân công", exact: true })).toHaveCount(0);
});

