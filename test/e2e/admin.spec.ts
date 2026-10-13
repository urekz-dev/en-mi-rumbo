// docs/specs/admin-review.md: "Locally, a fixed identity is injected only when
// the environment says `local` (v2)" and "The panel is not indexed nor linked
// from the public site". `astro preview` runs with the local vars of
// wrangler.jsonc (ENVIRONMENT=local) on localhost.
import { expect, test } from "@playwright/test";

test("local: /admin opens with the fixed identity and asks not to be indexed", async ({ page }) => {
  const response = await page.goto("/admin");

  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["cache-control"]).toBe("no-store");
  await expect(page.getByRole("heading", { level: 1, name: "Panel de enmirumbo" })).toBeVisible();
  await expect(page.getByTestId("admin-email")).toHaveText("admin@enmirumbo.test");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("no links from the public side: the home page does not link to /admin", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page.locator('a[href*="admin" i]')).toHaveCount(0);
  expect(await page.content()).not.toMatch(/\/admin/i);
});
