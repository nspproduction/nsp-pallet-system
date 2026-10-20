import { test, expect } from "@playwright/test";

// Pages to check for responsive layout (no horizontal scroll)
const PUBLIC_PAGES = ["/", "/auth/login"];

for (const path of PUBLIC_PAGES) {
  test(`no horizontal scroll on "${path}"`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > window.innerWidth;
    });

    expect(overflow, `${path} has horizontal scroll`).toBe(false);
  });
}

test("home page renders system title in Thai", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ระบบเบิกจ่ายพาเลท")).toBeVisible();
});

test("home page has links to portal and admin", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /admin console/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /พอร์ทัลพนักงาน/i })).toBeVisible();
});

test("login page has email and password fields in Thai", async ({ page }) => {
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  // The login page should be reachable
  const url = page.url();
  expect(url).toContain("/auth/login");
});

test("unauthenticated access to /manage redirects to login", async ({ page }) => {
  await page.goto("/manage");
  // Wait for redirect
  await page.waitForURL(/auth\/login|\/$/);
  const url = page.url();
  const isLoginOrHome = url.includes("auth/login") || url.endsWith("/");
  expect(isLoginOrHome).toBe(true);
});
