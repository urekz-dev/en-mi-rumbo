import { expect, test } from "@playwright/test";

test("the home page answers in Spanish with the Tailwind styles", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("EnMiRumbo");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  const heading = page.getByRole("heading", { level: 1, name: "EnMiRumbo" });
  await expect(heading).toBeVisible();
  // font-bold comes from Tailwind, so this fails if the CSS is missing.
  await expect(heading).toHaveCSS("font-weight", "700");
});
