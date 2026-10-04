import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 390, 1440]) {
  test(`chat composer and attachment remain accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    await setup(page, "MEMBER");
<<<<<<< HEAD
=======
    const photo = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 640;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#203d31";
      ctx.fillRect(0, 0, 960, 640);
      ctx.strokeStyle = "#d3f879";
      ctx.lineWidth = 8;
      ctx.strokeRect(80, 80, 800, 480);
      ctx.beginPath();
      ctx.moveTo(480, 80);
      ctx.lineTo(480, 560);
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = "32px sans-serif";
      ctx.fillText("PULSE / LICH TAP", 100, 140);
      return canvas.toDataURL("image/png").split(",")[1];
    });
>>>>>>> develop
    await page.route("**/api/v1/chat/attachments/photo*", (route) => {
      expect(route.request().headers().authorization).toBe(
        "Bearer fixture-token",
      );
      return route.fulfill({
        contentType: "image/png",
<<<<<<< HEAD
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7X8AAAAASUVORK5CYII=",
          "base64",
        ),
=======
        body: Buffer.from(photo, "base64"),
>>>>>>> develop
      });
    });
    const messages: object[] = [];
    await page.route("**/api/v1/chat/contacts", (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    await page.route("**/api/v1/chat/conversations", (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    await page.route("**/api/v1/chat/messages", async (route) => {
      if (route.request().method() === "POST") {
        expect(route.request().headers()["content-type"]).toContain(
          "multipart/form-data",
        );
        messages.push({
          id: "file-1",
          senderId: "member",
          sender: { fullName: "Hội viên" },
          fileUrl: "/api/v1/chat/attachments/photo?name=photo.png",
          createdAt: new Date().toISOString(),
        });
      }
      await route.fulfill({
        json: {
          success: true,
          data: route.request().method() === "POST" ? messages[0] : messages,
        },
      });
    });
    await page.goto("/member/membership");
    await page.getByRole("button", { name: "Mở điểm danh nhanh" }).click();
    await expect(page.getByText("Sẵn sàng cho buổi tập?")).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Mở tin nhắn", exact: true })
      .click();
    const input = page.getByRole("textbox", { name: "Nội dung", exact: true });
    await expect(input).toBeInViewport();

    await page
      .getByLabel("Ảnh (JPEG/PNG/WebP/GIF) hoặc PDF · tối đa 10 MB", {
        exact: true,
      })
      .setInputFiles({
        name: "photo.png",
        mimeType: "image/png",
        buffer: Buffer.from(photo, "base64"),
      });
    await page
      .getByRole("button", { name: "Gửi tin nhắn", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: "Ảnh đính kèm: photo.png" }),
    ).toBeVisible();
    await expect(input).toBeInViewport();
    const thumbnail = page.getByRole("button", {
      name: "Phóng to ảnh: photo.png",
    });
    await thumbnail.click();
    const viewer = page.getByRole("dialog", { name: "Xem ảnh đính kèm" });
    await expect(
      viewer.getByRole("img", { name: "Ảnh đính kèm: photo.png", exact: true }),
    ).toBeVisible();
    await viewer.getByRole("button", { name: "Phóng to thêm" }).click();
    await expect(viewer.getByLabel("Mức phóng to")).toHaveText("150%");
    await viewer.getByRole("button", { name: "Vừa khung" }).click();
    await expect(viewer.getByLabel("Mức phóng to")).toHaveText("100%");
    await expect(viewer.getByRole("link", { name: "Tải ảnh" })).toHaveAttribute(
      "download",
      "photo.png",
    );
    expect(
      await viewer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page.screenshot({
      path: `artifacts/heuristics/image-viewer-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(viewer).not.toBeVisible();
    await expect(thumbnail).toBeFocused();
  });
}
