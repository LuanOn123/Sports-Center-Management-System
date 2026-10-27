import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const width of [390, 1440]) {
  test(`coach card opens profile with all reviews and preserves review context at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, "MEMBER");
    await page.goto("/member/membership");
    const payload = await page.evaluate(async () =>
      (await fetch("/api/v1/classes/c1")).json(),
    );
    payload.data.id = "c1";
    payload.data.coaches = [
      {
        id: "assignment-1",
        isPrimary: true,
        coach: {
          id: "coach-profile-1",
          specialization: "Yoga",
          user: {
            id: "coach-user-1",
            fullName: "Nguyễn Minh Anh",
            email: "coach@example.test",
          },
        },
      },
    ];
    await page.route("**/api/v1/classes/c1", (route) =>
      route.fulfill({ json: payload }),
    );
    await page.route("**/api/v1/coaches/coach-user-1", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            fullName: "Nguyễn Minh Anh",
            coachProfile: {
              bio: "Hướng dẫn vận động an toàn và xây dựng thói quen tập luyện.",
              experienceYears: 5,
              specialization: "Yoga",
            },
          },
        },
      }),
    );
    await page.route("**/api/v1/enrollments/my?*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [{ id: "e1", status: "COMPLETED", classId: "c1" }],
        },
      }),
    );
    let saved: object | null = null;
    await page.route("**/api/v1/feedbacks/my", (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    await page.route("**/api/v1/feedbacks?*", (route) => {
      expect(new URL(route.request().url()).searchParams.get("coachId")).toBe(
        "coach-profile-1",
      );
      expect(new URL(route.request().url()).searchParams.has("classId")).toBe(
        false,
      );
      return route.fulfill({
        json: {
          success: true,
          data: {
            summary: { averageRating: 4.5, totalFeedbacks: 1 },
            feedbacks: [
              {
                id: "review-1",
                rating: 5,
                comment: "Hướng dẫn rất dễ hiểu.",
                isAnonymous: true,
              },
            ],
          },
        },
      });
    });
    await page.route("**/api/v1/feedbacks", (route) => {
      saved = route.request().postDataJSON();
      return route.fulfill({
        json: { success: true, data: { id: "review-new" } },
      });
    });
    await page.goto("/member/classes/c1");
    const card = page.getByRole("button", {
      name: "Xem hồ sơ Nguyễn Minh Anh",
    });
    await expect(card).toBeVisible();
    await expect(
      page.locator("details").filter({ hasText: "Đánh giá ·" }),
    ).toHaveCount(0);
    await card.click();
    const profile = page.getByRole("dialog", {
      name: "Hồ sơ huấn luyện viên",
      exact: true,
    });
    await expect(profile.getByText("5 năm huấn luyện")).toBeVisible();
    await expect(profile.getByText("Hướng dẫn rất dễ hiểu.")).toBeVisible();
    await expect(profile.getByText("Ẩn danh", { exact: false })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .include(".member-coach-profile")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/coach-profile-${width}.png` });
    await profile
      .getByRole("button", { name: "Viết đánh giá", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "Đánh giá huấn luyện viên",
      exact: true,
    });
    await form.getByLabel("Nhận xét").fill("Lớp học rất hữu ích.");
    await form.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect
      .poll(() => saved)
      .toMatchObject({
        coachId: "coach-profile-1",
        classId: "c1",
        rating: 5,
        comment: "Lớp học rất hữu ích.",
      });
    await expect(profile.getByRole("status")).toContainText("Đã lưu đánh giá");
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
  });
}
