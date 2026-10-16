// Scenarios of docs/specs/public-directory.md, requirements:
// - "Public URLs carry the state and the municipality (v2)"
// - "Unknown or inactive state and municipality answer 404 (v2)"
// - "While there is one active locality, the root redirects to it (v2)"
// - "There is no short alias of a locality (v2)"
// and of docs/specs/base-layout.md, "Canonical URLs, share previews and the
// sitemap use the full locality path (v2)". The global setup seeds the
// database, which turns Tizayuca on, so Tizayuca is its only active locality;
// `astro preview` runs with the local vars of wrangler.jsonc (SITE_URL is
// http://localhost:4321). Two active localities are covered by
// test/e2e/two-localities/, and none by test/worker/locality-routes.test.ts.
// The database holds no other real state or municipality, so the 404 checks
// add a fictitious one (./unserved-municipality.ts) and remove it.
import { expect, test } from "@playwright/test";
import {
  addUnservedMunicipality,
  removeUnservedMunicipality,
  UNSERVED,
} from "./unserved-municipality.ts";

const HOME = "/hidalgo/tizayuca";

test.describe("Public URLs carry the state and the municipality (v2)", () => {
  test("the home of the active locality answers under its state and municipality", async ({
    page,
  }) => {
    const response = await page.goto(HOME);

    expect(response?.status()).toBe(200);
    // The name comes from the locality record.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Qué necesitas en Tizayuca?");
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
  test.beforeAll(async () => {
    await addUnservedMunicipality();
  });
  test.afterAll(async () => {
    await removeUnservedMunicipality();
  });

  for (const [scenario, path] of [
    ["a state that does not exist", "/atlantida/tizayuca/"],
    ["a municipality the database does not hold", "/hidalgo/pachuca-de-soto"],
    ["a municipality that is not active", `/${UNSERVED.state.slug}/${UNSERVED.slug}`],
    ["a municipality under the wrong state", `/${UNSERVED.state.slug}/tizayuca/`],
    ["a page under an unknown state", "/atlantida/tizayuca/servicios-del-hogar"],
  ] as const) {
    test(scenario, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
    });
  }
});

test.describe("While there is one active locality, the root redirects to it (v2)", () => {
  // Scenario: the root; scenario: browsers ask again
  test("the root answers a 301 to the locality that browsers keep for an hour", async ({
    request,
  }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(response.headers()["location"]).toBe(HOME);
    expect(response.headers()["cache-control"]).toBe("max-age=3600");
  });

  test("a resident who opens the root lands on the home of the locality", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(HOME);
  });

  test("no chooser: a cookie, a choice or a request to change still lead to it", async ({
    request,
  }) => {
    for (const [path, cookie] of [
      ["/?cambiar", ""],
      ["/?elegir=hidalgo/tizayuca", ""],
      ["/?elegir=hidalgo/pachuca-de-soto", ""],
      ["/", "locality=pachuca-de-soto"],
    ] as const) {
      const response = await request.get(path, {
        headers: cookie ? { Cookie: cookie } : {},
        maxRedirects: 0,
      });

      expect(response.status(), path).toBe(301);
      expect(response.headers()["location"], path).toBe(HOME);
      expect(response.headers()["set-cookie"], path).toBeUndefined();
    }
  });

  // Scenario: no chooser
  test("the home offers no control to change locality", async ({ page }) => {
    await page.goto(HOME);

    await expect(page.getByRole("link", { name: "Cambiar de municipio" })).toHaveCount(0);
    await expect(page.locator('a[href*="cambiar"], a[href*="elegir"]')).toHaveCount(0);
  });
});

test.describe("There is no short alias of a locality (v2)", () => {
  // Scenario: the municipality slug alone
  for (const path of ["/tizayuca", "/tizayuca/", "/Tizayuca"]) {
    test(`${path} answers 404`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
    });
  }
});
