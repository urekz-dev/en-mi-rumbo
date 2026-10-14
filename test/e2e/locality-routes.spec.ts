// Scenarios of docs/specs/public-directory.md, requirements:
// - "Public URLs carry the state and the municipality (v2)"
// - "Unknown or inactive state and municipality answer 404 (v2)"
// - "While there is one active locality, the root and the alias redirect to it (v2)"
// and of docs/specs/base-layout.md, "Canonical URLs, share previews and the
// sitemap use the full locality path (v2)". The global setup seeds the
// database, which turns Tizayuca on, so Tizayuca is its only active locality;
// `astro preview` runs with the local vars of wrangler.jsonc (SITE_URL is
// http://localhost:4321). The cases with none or several active localities are
// covered by test/worker/locality-routes.test.ts.
import { expect, test } from "@playwright/test";

const HOME = "/hidalgo/tizayuca";

test.describe("Public URLs carry the state and the municipality (v2)", () => {
  test("the home of the active locality answers under its state and municipality", async ({
    page,
  }) => {
    const response = await page.goto(HOME);

    expect(response?.status()).toBe(200);
    // The name comes from the locality record.
    await expect(
      page.getByText("Estamos armando el directorio de negocios de Tizayuca."),
    ).toBeVisible();
  });

  test("its canonical and Open Graph URLs are absolute, with the full path", async ({ page }) => {
    await page.goto(HOME);

    const canonical = `http://localhost:4321${HOME}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical);
  });

  test("the same path without the prefix answers 404", async ({ request }) => {
    for (const path of ["/plomeria-haciendas-de-tizayuca", "/servicios-del-hogar", "/hidalgo"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe("Unknown or inactive state and municipality answer 404 (v2)", () => {
  for (const [scenario, path] of [
    ["a state that does not exist", "/atlantida/tizayuca/"],
    ["a real municipality that is not active", "/hidalgo/pachuca-de-soto"],
    ["a municipality under the wrong state", "/jalisco/tizayuca/"],
    ["a page under an unknown state", "/atlantida/tizayuca/servicios-del-hogar"],
  ] as const) {
    test(scenario, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
    });
  }
});

test.describe("While there is one active locality, the root and the alias redirect to it (v2)", () => {
  for (const [scenario, path] of [
    ["the root", "/"],
    ["the alias", "/tizayuca"],
  ] as const) {
    test(`${scenario} answers a 301 to the locality`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(301);
      expect(response.headers()["location"]).toBe(HOME);
    });
  }

  test("a resident who opens the root lands on the home of the locality", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(HOME);
  });
});
