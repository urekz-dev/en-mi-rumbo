import { expect, test } from "@playwright/test";

// The end-to-end database has one active locality, so / leads to its home.
test("the home page answers in Spanish with the Tailwind styles", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/hidalgo/tizayuca");
  await expect(page).toHaveTitle("enmirumbo — Encuentra negocios y servicios en Tizayuca");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  const heading = page.getByRole("heading", { level: 1, name: "¿Qué necesitas en Tizayuca?" });
  await expect(heading).toBeVisible();
  // font-bold comes from Tailwind, so this fails if the CSS is missing.
  await expect(heading).toHaveCSS("font-weight", "700");
});
