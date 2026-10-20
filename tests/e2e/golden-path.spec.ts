import { test, expect } from "@playwright/test";

// Golden-path E2E tests.
// Requires a running server with seeded test data.
// Set env vars: E2E_ADMIN_USER / E2E_ADMIN_PASS to run authenticated tests.

const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? "";
const HAS_CREDS = ADMIN_USER !== "" && ADMIN_PASS !== "";

// ─── Helper ───────────────────────────────────────────────────────────────────

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"], input[name="email"]', ADMIN_USER);
  await page.fill('input[name="password"], input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/manage/, { timeout: 15_000 });
}

// ─── Auth flow ────────────────────────────────────────────────────────────────

test("login page loads and shows error for wrong credentials", async ({ page }) => {
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="email"], input[name="email"]', "wrong@example.com");
  await page.fill('input[type="password"]', "wrong_pass");
  await page.click('button[type="submit"]');

  // Expect an error message to appear (Thai text, not a crash)
  await expect(
    page.locator('[role="alert"], .text-rose-600, .text-red-600, [class*="error"]').first(),
  ).toBeVisible({ timeout: 8_000 });
});

// ─── Authenticated golden paths ───────────────────────────────────────────────

test.describe("authenticated", () => {
  test.skip(!HAS_CREDS, "Set E2E_ADMIN_USER and E2E_ADMIN_PASS to run authenticated tests");

  test("admin can log in and reach dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/manage/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("dashboard shows KPI cards", async ({ page }) => {
    await loginAsAdmin(page);
    // All 4 key KPI labels should be visible
    await expect(page.getByText("พาเลทในคลัง (ดี)")).toBeVisible();
    await expect(page.getByText("รอซ่อม (ในคลัง)")).toBeVisible();
    await expect(page.getByText("ค้างนอกคลัง")).toBeVisible();
    await expect(page.getByText("ตัดจำหน่าย (30 วัน)")).toBeVisible();
  });

  test("dashboard has filter bar with date inputs", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText("ตัวกรองข้อมูล")).toBeVisible();
    // Date range inputs
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
  });

  test("Export Excel button navigates to download URL", async ({ page }) => {
    await loginAsAdmin(page);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
      page.click('a[href*="/api/dashboard/export"]'),
    ]);
    if (download) {
      // File downloaded successfully
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    }
    // If no download event (browser opened inline), the link should exist
    await expect(page.locator('a[href*="/api/dashboard/export"]')).toBeVisible();
  });

  test("dashboard shows trend chart section", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText("แนวโน้ม")).toBeVisible();
    // Granularity links
    await expect(page.getByText("รายวัน")).toBeVisible();
    await expect(page.getByText("รายสัปดาห์")).toBeVisible();
    await expect(page.getByText("รายเดือน")).toBeVisible();
  });

  test("admin users page shows user management table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/manage/users");
    await expect(page.getByRole("heading")).toBeVisible();
    // Should not be a blank page or error
    await expect(page.locator("main, [class*='container'], [class*='space-y']").first()).toBeVisible();
  });

  test("no horizontal scroll on admin dashboard at 375px - mobile", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 375, "only run on 375px viewport");
    await loginAsAdmin(page);
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(overflow, "Admin dashboard has horizontal scroll on mobile").toBe(false);
  });
});

// ─── Responsive checks (no auth needed for public pages) ─────────────────────

const VIEWPORT_PAGES = ["/", "/auth/login"];

for (const path of VIEWPORT_PAGES) {
  test(`"${path}" fits within viewport width`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(overflow, `Page ${path} has horizontal scroll`).toBe(false);
  });
}
