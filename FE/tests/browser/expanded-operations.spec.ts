import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

test("Member assistant sends authenticated personal questions", async ({ page }) => {
  await setup(page, "MEMBER");
  let request: { auth?: string; message?: string } = {};
  await page.route("**/api/v1/ai/member-chat", (route) => {
    request = {
      auth: route.request().headers().authorization,
      message: route.request().postDataJSON().message,
    };
    return route.fulfill({ json: { success: true, data: { reply: "Bạn có lớp Yoga vào 18:00." } } });
  });
  await page.goto("/member/ai-assistant");
  const composer = page.getByLabel("Câu hỏi cho AI");
  await page.getByRole("button", { name: "Lịch tập sắp tới của tôi?" }).click();
  await expect(composer).toHaveValue("Lịch tập sắp tới của tôi?");
  await composer.fill("Lịch tập của tôi hôm nay?");
  await composer.press("Enter");
  await expect(page.getByText("Bạn có lớp Yoga vào 18:00.")).toBeVisible();
  expect(request).toEqual({ auth: "Bearer fixture-token", message: "Lịch tập của tôi hôm nay?" });
});

test("Receptionist checks a member in and opens a support ticket on their behalf", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  const writes: unknown[] = [];
  const member = { id: "member-1", user: { fullName: "Nguyễn An", email: "an@example.test" } };
  await page.route(/\/api\/v1\/members(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { success: true, data: [member] } }),
  );
  await page.route(/\/api\/v1\/facility-visits(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route("**/api/v1/facility-visits/reception-check-in", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: { id: "visit-1", checkInAt: "2026-11-16T09:00:00Z" } } });
  });
  await page.route("**/api/v1/issues", (route) => {
    if (route.request().method() === "POST") writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto("/receptionist/checkin");
  await page.getByRole("combobox", { name: "Hội viên", exact: true }).selectOption(member.id);
  await page.getByRole("button", { name: "Check-in vào cơ sở" }).click();
  await expect(page.getByText(/Đã ghi nhận lượt vào cửa/)).toBeVisible();
  await page.getByRole("link", { name: "Yêu cầu hỗ trợ", exact: true }).click();
  await page.getByRole("button", { name: "Thêm mới", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Chọn", exact: true }).click();
  await dialog.getByLabel("Tiêu đề").fill("Đổi giờ học");
  await dialog.getByLabel("Mô tả").fill("Hội viên cần hỗ trợ đổi sang buổi chiều.");
  await dialog.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([
    { memberId: member.id, method: "RECEPTION" },
    { memberId: member.id, title: "Đổi giờ học", description: "Hội viên cần hỗ trợ đổi sang buổi chiều." },
  ]);
});

test("Manager filters facility activity and can open the scoped audit log", async ({ page }) => {
  await setup(page, "MANAGER");
  await page.route(/\/api\/v1\/reports\/facility-activity\?/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { activeMembers: 11, newMembers: 3, bookingsByStatus: { BOOKED: 5, COMPLETED: 2, CANCELLED: 1 } },
      },
    }),
  );
  await page.route(/\/api\/v1\/audit-logs(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.goto("/manager/reports");
  await expect(page.getByText("Hội viên có hoạt động")).toBeVisible();
  const response = page.waitForResponse((item) => item.url().includes("/reports/facility-activity?") && item.url().includes("startDate=2026-01-01"));
  await page.getByLabel("Từ ngày").fill("2026-01-01");
  await response;
  await page.getByRole("link", { name: "Nhật ký cơ sở" }).click();
  await expect(page.getByRole("heading", { name: "Nhật ký hoạt động" })).toBeVisible();
});

test("Receptionist sends an attendance violation report from a member's session history", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  const row = {
    memberId: "member-1", classId: "class-1", memberName: "Nguyễn An", className: "Yoga",
    attendedCount: 2, absentCount: 1, absenceRate: 33.33, status: "VIOLATION", warningSent: true,
  };
  let submitted: unknown;
  await page.route(/\/api\/v1\/attendance\/monitoring\?/, (route) =>
    route.fulfill({ json: { success: true, data: [row] } }),
  );
  await page.route(/\/api\/v1\/attendance\/monitoring\/detail\?/, (route) =>
    route.fulfill({ json: { success: true, data: {
      summary: { ...row, reportStatus: submitted ? "PENDING" : null },
      sessions: [{ scheduleId: "slot-1", startTime: "2026-11-16T02:00:00Z", roomName: "Phòng Yoga", state: "ABSENT" }],
    } } }),
  );
  await page.route("**/api/v1/attendance/reports", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { success: true, data: { id: "report-1" } } });
  });
  await page.goto("/receptionist/attendance");
  await page.getByRole("button", { name: "Xem chuyên cần" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Phòng Yoga.*Vắng/)).toBeVisible();
  await dialog.getByLabel("Lý do báo cáo").fill("Đã đối chiếu chuyên cần với huấn luyện viên.");
  await dialog.getByRole("button", { name: "Gửi báo cáo cho quản lý" }).click();
  await expect(dialog.getByText("Đã gửi báo cáo.")).toBeVisible();
  expect(submitted).toMatchObject({ memberId: "member-1", classId: "class-1" });
});
