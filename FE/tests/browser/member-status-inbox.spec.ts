import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const tier of ["FREE", "MEMBERSHIP"]) {
  test(`course registration directs ${tier} members to the appropriate action`, async ({
    page,
  }) => {
    await setup(page, "MEMBER");
    await page.goto("/member/membership");
    const payload = await page.evaluate(async () =>
      (await fetch("/api/v1/classes/c1/course-plan")).json(),
    );
    payload.data.registration.eligible = false;
    payload.data.registration.quota = {
      tier,
      limit: tier === "FREE" ? 0 : 3,
      used: tier === "FREE" ? 0 : 3,
      remaining: 0,
      classes: [],
    };
    payload.data.registration.blockers = [
      {
        code: "CONCURRENT_CLASS_LIMIT_REACHED",
        message: `Bạn đã đạt giới hạn ${tier === "FREE" ? 0 : 3} lớp học song song của gói ${tier}. Vui lòng hủy hoặc chuyển một lớp đang đặt trước khi đăng ký khóa mới.`,
        details: { tier },
      },
    ];
    await page.route("**/api/v1/classes/c1/course-plan", (route) =>
      route.fulfill({ json: payload }),
    );
    await page.goto("/member/classes/c1");
    if (tier === "FREE") {
      await expect(
        page.getByText("Tài khoản Free chưa bao gồm quyền đăng ký lớp học.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(page.getByText(/đạt giới hạn 0 lớp/)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Xem các lớp đang giữ" }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Xem các gói tập", exact: true })
        .click();
      await expect(page).toHaveURL(/\/member\/membership$/);
    } else {
      await expect(
        page.getByRole("button", { name: "Xem các lớp đang giữ" }),
      ).toBeVisible();
    }
  });
}

for (const width of [390, 1440]) {
  test(`inbox opens before messages, prioritizes unread and supports search at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, "MEMBER");
    const people = [
      {
        id: "coach-new",
        fullName: "An Huấn luyện viên",
        role: "COACH",
        email: "an@example.test",
      },
      {
        id: "coach-unread",
        fullName: "Bình Huấn luyện viên",
        role: "COACH",
        email: "binh@example.test",
      },
      {
        id: "coach-search",
        fullName: "Chi Huấn luyện viên",
        role: "COACH",
        email: "chi@example.test",
      },
    ];
    await page.route("**/api/v1/chat/contacts", (route) =>
      route.fulfill({ json: { success: true, data: people } }),
    );
    await page.route("**/api/v1/chat/conversations", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              user: people[0],
              unreadCount: 0,
              latestMessage: {
                id: "m1",
                senderId: people[0].id,
                content: "Lịch tập mới",
                createdAt: "2026-10-27T08:00:00Z",
              },
            },
            {
              user: people[1],
              unreadCount: 2,
              latestMessage: {
                id: "m2",
                senderId: people[1].id,
                content: "Bạn cần xác nhận",
                createdAt: "2026-10-26T08:00:00Z",
              },
            },
          ],
        },
      }),
    );
    let messageRequests = 0;
    await page.route("**/api/v1/chat/messages?*", (route) => {
      messageRequests++;
      return route.fulfill({ json: { success: true, data: [] } });
    });
    await page.goto("/member/membership");
    const trigger = page.locator(".pulse-quick-trigger");
    await expect(trigger.locator("svg")).toHaveCount(0);
    await trigger.hover();
    await expect(trigger.locator("img")).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    await page.getByRole("button", { name: "Tin nhắn", exact: true }).click();
    const inbox = page.getByRole("complementary", {
      name: "Danh sách trò chuyện",
    });
    await expect(inbox).toBeVisible();
    await expect(
      inbox.locator(".chat-conversation-row").first(),
    ).toHaveAttribute("aria-label", people[1].fullName);
    expect(messageRequests).toBe(0);
    await expect(page.locator(".chat-connection")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Nội dung", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `artifacts/inbox-${width}.png` });
    const scan = await new AxeBuilder({ page })
      .include(".floating-chat-panel")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page
      .getByRole("textbox", { name: "Tìm cuộc trò chuyện" })
      .fill("chi@example");
    await expect(inbox.locator(".chat-conversation-row")).toHaveCount(1);
    await inbox
      .getByRole("button", { name: people[2].fullName, exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Nội dung", exact: true }),
    ).toBeInViewport();
    await expect.poll(() => messageRequests).toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Quay lại cuộc trò chuyện" })
      .click();
    await expect(inbox).toBeVisible();
    await page
      .getByRole("textbox", { name: "Tìm cuộc trò chuyện" })
      .fill("không tìm thấy");
    await expect(
      inbox.getByText("Không tìm thấy người phù hợp."),
    ).toBeVisible();
  });
}

for (const [status, text] of [
  ["OPEN_REGISTRATION", "Đang mở đăng ký"],
  ["PLANNING", "Đang chuẩn bị"],
  ["CLOSED", "Đã kết thúc"],
]) {
  test(`term banner uses readable system colors for ${status}`, async ({
    page,
  }) => {
    await setup(page, "MEMBER");
    await page.route("**/api/v1/terms/current", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            id: "term-test",
            name: "Kỳ Mùa Đông 2026",
            status,
            registrationStartDate: new Date(
              Date.now() - 86400000,
            ).toISOString(),
            registrationEndDate: new Date(
              Date.now() + 86400000 * 10,
            ).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 90).toISOString(),
          },
        },
      }),
    );
    for (const path of ["dashboard", "classes"]) {
      await page.goto(`/member/${path}`);
      const banner = page.getByRole("region", { name: "Thông tin kỳ học" });
      await expect(banner).toContainText(text);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".member-term-banner")
            .withTags(["wcag2aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({ path: `artifacts/term-${status}-${path}.png` });
    }
  });
}

for (const tier of ["FREE", "MEMBERSHIP"]) {
  test(`class access summary gives useful guidance for ${tier}`, async ({
    page,
  }) => {
    await setup(page, "MEMBER");
    await page.route("**/api/v1/enrollments/my/quota", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            tier,
            hasActiveSubscription: true,
            used: tier === "FREE" ? 0 : 1,
            limit: tier === "FREE" ? 0 : 3,
            remaining: tier === "FREE" ? 0 : 2,
            classes: [],
          },
        },
      }),
    );
    await page.goto("/member/my-classes");
    const summary = page.getByRole("region", { name: "Quyền đăng ký lớp học" });
    await expect(summary).toContainText(
      tier === "FREE"
        ? "Tài khoản Free chưa bao gồm lớp học"
        : "Bạn có thể đăng ký thêm 2 lớp khác nhau.",
    );
    await expect(summary.getByRole("progressbar")).toHaveCount(0);
    if (tier === "FREE")
      await expect(
        summary.getByRole("link", { name: "Xem các gói tập" }),
      ).toHaveAttribute("href", "/member/membership");
  });
}
