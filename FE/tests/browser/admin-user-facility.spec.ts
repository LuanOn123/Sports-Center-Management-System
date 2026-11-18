import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

const facilityA = "10000000-0000-4000-8000-000000000001";
const facilityB = "10000000-0000-4000-8000-000000000002";

test("Admin lists all facilities, filters accounts and moves a receptionist", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  let selectedFacility = facilityA;
  const account = () => ({
    id: "receptionist-1",
    fullName: "Lễ tân A",
    email: "reception@example.test",
    role: "RECEPTIONIST",
    isActive: true,
    facilityName: selectedFacility === facilityA ? "Cơ sở A" : "Cơ sở B",
    facilityAssignments: [
      {
        role: "RECEPTIONIST",
        facility: {
          id: selectedFacility,
          name: selectedFacility === facilityA ? "Cơ sở A" : "Cơ sở B",
        },
      },
    ],
  });
  await page.route(/\/api\/v1\/facilities(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { id: facilityA, name: "Cơ sở A", isActive: true },
          { id: facilityB, name: "Cơ sở B", isActive: true },
        ],
      },
    }),
  );
  await page.route(/\/api\/v1\/users(?:\?|\/|$)/, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "PATCH") {
      const body = req.postDataJSON();
      writes.push({ method: "PATCH", body });
      selectedFacility = body.facilityId;
      return route.fulfill({ json: { success: true, data: account() } });
    }
    if (req.method() === "POST") {
      writes.push({ method: "POST", body: req.postDataJSON() });
      return route.fulfill({
        status: 201,
        json: { success: true, data: { id: "new-user" } },
      });
    }
    if (url.pathname.endsWith("/receptionist-1"))
      return route.fulfill({ json: { success: true, data: account() } });
    const filter = url.searchParams.get("facilityId");
    return route.fulfill({
      json: {
        success: true,
        data: !filter || filter === selectedFacility ? [account()] : [],
      },
    });
  });
  await page.goto("/admin/users");
  await expect(page.locator("header .facility-switch")).toHaveCount(0);
  await expect(page.getByText("Lễ tân A", { exact: true })).toBeVisible();
  const filter = page.getByRole("combobox", {
    name: "Lọc theo cơ sở",
    exact: true,
  });
  await filter.selectOption(facilityB);
  await expect(page.getByText("Lễ tân A", { exact: true })).toHaveCount(0);
  await filter.selectOption("");
  await page
    .getByRole("button", { name: "Chỉnh sửa", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Cơ sở phân công", { exact: true }),
  ).toHaveValue(facilityA);
  await dialog
    .getByLabel("Cơ sở phân công", { exact: true })
    .selectOption(facilityB);
  await dialog
    .getByRole("button", { name: "Lưu thay đổi", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(writes[0]).toMatchObject({
    method: "PATCH",
    body: { facilityId: facilityB, role: "RECEPTIONIST" },
  });
  await expect(page.getByRole("row", { name: /Lễ tân A/ })).toContainText(
    "Cơ sở B",
  );
  await page
    .getByRole("button", { name: "Thêm người dùng", exact: true })
    .click();
  await dialog.getByLabel(/^Email/).fill("new-reception@example.test");
  await dialog.getByLabel(/^Mật khẩu/).fill("Test@123456");
  await dialog.getByLabel(/^Họ và tên/).fill("Lễ tân mới");
  await dialog.getByLabel(/^Vai trò/).selectOption("RECEPTIONIST");
  await dialog
    .getByLabel("Cơ sở phân công", { exact: true })
    .selectOption(facilityB);
  await dialog
    .getByRole("button", { name: "Lưu thay đổi", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(writes[1]).toMatchObject({
    method: "POST",
    body: { facilityId: facilityB, role: "RECEPTIONIST" },
  });
  await page.route(/\/api\/v1\/sports(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ id: "yoga", name: "Yoga", isActive: true }],
      },
    }),
  );
  await page
    .getByRole("button", { name: "Thêm người dùng", exact: true })
    .click();
  await dialog.getByLabel(/^Email/).fill("new-coach@example.test");
  await dialog.getByLabel(/^Mật khẩu/).fill("Test@123456");
  await dialog.getByLabel(/^Họ và tên/).fill("HLV mới");
  await dialog.getByLabel(/^Vai trò/).selectOption("RECEPTIONIST");
  await dialog
    .getByLabel("Cơ sở phân công", { exact: true })
    .selectOption(facilityB);
  await dialog.getByLabel(/^Vai trò/).selectOption("COACH");
  await expect(
    dialog.getByLabel("Cơ sở phân công", { exact: true }),
  ).toHaveValue(facilityB);
  await dialog.getByRole("checkbox", { name: "Yoga", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Tạo Huấn luyện viên", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(writes[2]).toMatchObject({
    method: "POST",
    body: { facilityId: facilityB, role: "COACH", sportIds: ["yoga"] },
  });
});
