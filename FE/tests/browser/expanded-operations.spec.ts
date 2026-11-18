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

test("Reception checks a member in at the front desk and support has no create button", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  await page.route("**/api/v1/issues", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route(/\/api\/v1\/members(\?.*)?$/, (route) =>
    route.fulfill({
      json: { success: true, data: [{ id: "member-1", userId: "user-1", user: { fullName: "Nguyễn An", email: "an@example.com" } }] },
    }),
  );
  await page.route(/\/api\/v1\/facility-visits(\?.*)?$/, (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  const checkIns: unknown[] = [];
  await page.route("**/api/v1/facility-visits/reception-check-in", (route) => {
    checkIns.push(route.request().postDataJSON());
    const visit = { id: "visit-1", checkInAt: "2026-11-18T08:00:00.000Z", method: "RECEPTION" };
    // Lượt thứ hai trong 5 phút: BE trả 200 và không tạo lượt mới
    return route.fulfill(checkIns.length === 1
      ? { status: 201, json: { success: true, message: "Checked in successfully", data: visit } }
      : { status: 200, json: { success: true, message: "Already checked in recently", data: visit } });
  });
  await page.goto("/receptionist/checkin");
  await expect(page).toHaveURL(/\/receptionist\/checkin$/);
  await expect(page.getByRole("link", { name: "Check-in cơ sở", exact: true })).toBeVisible();
  // Máy quét cầm tay gõ nội dung QR (userId trên app hội viên) vào ô đang được chọn rồi nhấn Enter
  const code = page.getByLabel("Quét hoặc nhập mã hội viên");
  await expect(code).toBeFocused();
  await code.fill("  user-1 ");
  await code.press("Enter");
  await expect(page.getByText(/Đã ghi nhận lượt vào cửa cho Nguyễn An lúc/)).toBeVisible();
  await expect(code).toHaveValue("");
  await expect(code).toBeFocused();
  await expect(page.getByRole("button", { name: "Quét bằng camera" })).toBeVisible();
  // Chọn từ danh sách vẫn dùng được; trùng trong 5 phút thì báo rõ, không giả vờ đã ghi lượt mới
  await page.getByLabel("Hoặc chọn hội viên").selectOption("member-1");
  await page.getByRole("button", { name: "Check-in vào cơ sở", exact: true }).click();
  await expect(page.getByText(/Nguyễn An đã check-in lúc .+ không ghi thêm lượt mới/)).toBeVisible();
  expect(checkIns).toEqual([
    { memberId: "user-1", method: "RECEPTION" },
    { memberId: "member-1", method: "RECEPTION" },
  ]);
  await expect(page.getByRole("link", { name: "Chuyên cần", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Yêu cầu hỗ trợ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Yêu cầu hỗ trợ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm mới", exact: true })).toHaveCount(0);
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
