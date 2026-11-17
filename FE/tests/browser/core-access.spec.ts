import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

const blockedRoutes = [
  { role: "MEMBER", path: "/admin/payments?tab=refunds", home: "/member" },
  { role: "MEMBER", path: "/receptionist/orders", home: "/member" },
  { role: "COACH", path: "/receptionist/payments", home: "/coach" },
  { role: "COACH", path: "/member/membership", home: "/coach" },
  { role: "MANAGER", path: "/admin/payments", home: "/manager" },
  { role: "MANAGER", path: "/receptionist/orders", home: "/manager" },
  { role: "RECEPTIONIST", path: "/admin/subscriptions", home: "/receptionist" },
  { role: "RECEPTIONIST", path: "/member/membership", home: "/receptionist" },
  { role: "ADMIN", path: "/receptionist/orders", home: "/admin" },
];

for (const { role, path, home } of blockedRoutes) {
  test(`${role} cannot render the financial workflow at ${path}`, async ({
    page,
  }) => {
    await setup(page, role);
    const financialCalls: string[] = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (
        /^\/api\/v1\/(payments|counter-orders|subscriptions|membership-plans)(\/|$)/.test(
          pathname,
        )
      ) {
        financialCalls.push(pathname);
      }
    });
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Không có quyền truy cập" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Về không gian của tôi" }),
    ).toHaveAttribute("href", `${home}/dashboard`);
    expect(financialCalls).toEqual([]);
  });
}
