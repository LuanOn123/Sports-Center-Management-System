import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

test("member can view classes without leave, transfer or cancellation actions", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  const writes: string[] = [];
  const enrollment = {
    id: "enrollment-1",
    classId: "class-1",
    scheduleId: "session-1",
    status: "BOOKED",
    schedule: {
      id: "session-1",
      status: "SCHEDULED",
      startTime: "2099-10-01T11:00:00Z",
      endTime: "2099-10-01T12:00:00Z",
      class: {
        id: "class-1",
        name: "Yoga kiểm tra",
        sports: [{ id: "yoga", name: "Yoga" }],
      },
      room: { id: "r1", name: "Phòng Yoga" },
    },
  };
  await page.route("**/api/v1/enrollments/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({
        status: 400,
        json: { success: false, message: "Unexpected member action" },
      });
    }
    if (url.pathname.endsWith("/enrollments/my"))
      return route.fulfill({
        json: {
          success: true,
          data: url.searchParams.get("status") === "BOOKED" ? [enrollment] : [],
        },
      });
    if (url.pathname.endsWith("/enrollments/my/quota"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            hasActiveSubscription: true,
            tier: "MEMBERSHIP",
            used: 1,
            limit: 3,
            remaining: 2,
            classes: [],
          },
        },
      });
    return route.fallback();
  });
  await page.goto("/member/my-classes");
  await expect(
    page.getByRole("button", { name: "Xem lớp", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Xin nghỉ|Đổi buổi|Hủy đặt chỗ/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/gửi đơn xin nghỉ/i)).toHaveCount(0);
  await expect(
    page.getByText(/Nếu cần hỗ trợ về lịch học, vui lòng liên hệ lễ tân cơ sở/),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Đã hoàn thành", exact: true })
    .click();
  await expect(
    page.getByText("Chưa có buổi học nào đã hoàn thành", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đã hủy", exact: true }).click();
  await expect(
    page.getByText("Không có lịch sử hủy lớp", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sắp tới (Đã đặt)", exact: true })
    .click();
  await page.getByRole("button", { name: "Xem lớp", exact: true }).click();
  await expect(page).toHaveURL(/\/member\/classes\/class-1$/);
  expect(writes).toEqual([]);
});
