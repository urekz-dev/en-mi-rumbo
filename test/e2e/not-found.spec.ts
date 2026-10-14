// docs/specs/base-layout.md, requirement "404 page in Spanish inside the
// layout", for URLs outside any locality. A 404 inside a locality, with its
// footer and its home, is tested in test/astro/layout.test.ts.
import { expect, test } from "@playwright/test";

for (const path of ["/no-existe", "/una/ruta/que/no/existe", "/admin/no-existe"]) {
  // Scenario: unknown URL
  test(`${path} answers 404 with the site's page, inside the layout`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("banner").getByRole("link", { name: "enmirumbo" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
    await expect(
      main.getByText(
        "A lo mejor el negocio ya no está publicado o la dirección quedó mal escrita.",
      ),
    ).toBeVisible();
    await expect(main.getByRole("link")).toHaveCount(1);
    await expect(main.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });
}

// Scenario: the 404 is neither an English page nor a technical dump
test("the 404 shows no technical detail, and its only link leads to the home", async ({ page }) => {
  await page.goto("/no-existe");

  const text = await page.getByRole("main").innerText();
  expect(text).not.toMatch(/404|not found|error|stack|undefined|astro|next\.?js/i);
  await expect(page).toHaveTitle("enmirumbo");

  // The root may redirect to a locality (ADR 0007); it is no 404 either way.
  await page.getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page).not.toHaveURL(/no-existe/);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toHaveCount(0);
});
