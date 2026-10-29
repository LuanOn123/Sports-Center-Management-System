import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("class edits retain their snapshot until an explicit refresh with reason", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  let equipped = false;
  const bodies: Record<string, unknown>[] = [];
  const sport = {
    id: "gym",
    name: "Gym",
    isActive: true,
    areaTypes: ["INDOOR"],
    requirements: [{ key: "training_equipment", minimum: 1 }],
  };
  const room = () => ({
    id: "room",
    name: "Phòng A",
    capacity: 20,
    areaType: "INDOOR",
    isActive: true,
    capabilities: equipped ? [{ key: "training_equipment", quantity: 1 }] : [],
  });
  const row = {
    id: "class",
    name: "Gym sáng",
    areaType: "INDOOR",
    capacity: 10,
    minCapacity: 1,
    classType: "REGULAR",
    defaultRoomId: "room",
    requirementsSnapshot: {},
    sports: [sport],
    attendancePolicy: "RECURRING",
    isActive: true,
    coaches: [],
    _count: { enrollments: 0 },
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (path === "/classes/class" && req.method() === "PATCH") {
      bodies.push(req.postDataJSON());
      return route.fulfill({ json: { success: true, data: row } });
    }
    if (path === "/classes") data = [row];
    else if (path === "/classes/class") data = row;
    else if (path === "/sports") data = [sport];
    else if (path === "/rooms") data = [room()];
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/manager/classes");
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Tên lớp học", { exact: true })
    .fill("Gym đã đổi tên");
  await dialog.getByRole("button", { name: "Lưu lớp học" }).click();
  await expect(dialog).not.toBeVisible();
  expect(bodies[0].refreshRequirements).toBeUndefined();
  equipped = true;
  await page.reload();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", {
      name: "Cập nhật điều kiện lớp theo bộ môn hiện tại",
    })
    .check();
  await dialog
    .getByLabel("Lý do cập nhật điều kiện")
    .fill("Phòng đã bổ sung dụng cụ");
  await dialog.getByRole("button", { name: "Lưu lớp học" }).click();
  await expect(dialog).not.toBeVisible();
  expect(bodies[1]).toMatchObject({
    refreshRequirements: true,
    reason: "Phòng đã bổ sung dụng cụ",
  });
});
