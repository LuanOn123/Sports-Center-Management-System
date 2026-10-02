import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

test("public chat sends real history, renders Markdown and recovers from errors", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route("**/api/v1/ai/chat", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: bodies.length === 2 ? 503 : 200,
      json:
        bodies.length === 2
          ? { success: false, message: "AI chưa được cấu hình" }
          : {
              success: true,
              data: { reply: "**Yoga** phù hợp. <script>alert(1)</script>" },
            },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
  await page
    .getByRole("textbox", { name: "Câu hỏi cho AI" })
    .fill("  Có lớp Yoga không?  ");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(page.locator(".ai-markdown strong")).toHaveText("Yoga");
  expect(bodies[0]).toEqual({ message: "Có lớp Yoga không?", history: [] });
  await page
    .getByRole("textbox", { name: "Câu hỏi cho AI" })
    .fill("Học lúc nào?");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "AI chưa được cấu hình",
  );
  await expect(
    page.getByRole("textbox", { name: "Câu hỏi cho AI" }),
  ).toHaveValue("Học lúc nào?");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(page.locator(".ai-markdown strong")).toHaveCount(2);
  expect(bodies[2]).toEqual(bodies[1]);
  expect((bodies[1] as { history: unknown[] }).history).toHaveLength(2);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Mở trợ lý AI" }),
  ).toBeFocused();
});

test("member generation sends bearer without body, displays saved plan and refreshes list", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  let listRequests = 0;
  await page.route("**/api/v1/training-plans*", (route) => {
    listRequests++;
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.route("**/api/v1/ai/generate-training-plan", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toBe(
      "Bearer fixture-token",
    );
    expect(route.request().postData()).toBeNull();
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: "ai-plan",
          name: "Kế hoạch 7 ngày",
          description: "## Ngày 1\n\n- **Khởi động** 10 phút",
        },
      },
    });
  });
  await page.goto("/member/dashboard");
  await page
    .getByRole("button", { name: "Tạo Lịch Tập Thông Minh Bằng AI" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ngày 1", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ai-plan").getByRole("status")).toContainText(
    "Đã tạo và lưu",
  );
  await page
    .getByRole("link", { name: "Xem tất cả kế hoạch tập luyện" })
    .click();
  await expect.poll(() => listRequests).toBeGreaterThan(0);
});

test("incomplete profile links to editable profile", async ({ page }) => {
  await setup(page, "MEMBER");
  await page.route("**/api/v1/ai/generate-training-plan", (route) =>
    route.fulfill({
      status: 400,
      json: {
        success: false,
        message: "Vui lòng cập nhật mục tiêu và trình độ trong hồ sơ.",
      },
    }),
  );
  await page.goto("/member/dashboard");
  await page
    .getByRole("button", { name: "Tạo Lịch Tập Thông Minh Bằng AI" })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Vui lòng cập nhật",
  );
  await page
    .getByRole("link", { name: "Cập nhật mục tiêu và trình độ trong hồ sơ" })
    .click();
  await expect(page).toHaveURL(/member\/profile/);
});

for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`AI popup fits ${width}px and prevents duplicate submissions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    await page.route("**/api/v1/ai/chat", async (route) => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        json: { success: true, data: { reply: "Chào bạn" } },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
    await page
      .getByRole("textbox", { name: "Câu hỏi cho AI" })
      .fill("Xin chào");
    await page.getByRole("button", { name: "Gửi", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Gửi", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText("Chào bạn", { exact: true })).toBeVisible();
    expect(calls).toBe(1);
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    if (width === 375 || width === 1440) {
      await expect(page.locator(".ai-markdown")).toHaveCount(2);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/ai/chat-${width}.png` });
    }
  });
}
