// docs/specs/base-layout.md: "Deployed environments stay out of search engines
// until the cut-over (v2)", scenario "local", and docs/specs/deployment.md:
// "The dev footer names the branch and commit deployed (v2)". `astro preview`
// runs the build through src/worker.ts with the local vars of wrangler.jsonc
// (ENVIRONMENT=local); the deployed behaviour is covered by
// test/worker/robots.test.ts, test/scripts/static-noindex.test.ts (the static
// assets) and the smoke test of the deploy workflows.
import { expect, test } from "@playwright/test";

test("local: robots.txt allows the site except the panel", async ({ request }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(response.headers()["x-robots-tag"]).toBeUndefined();
  expect(await response.text()).toBe("User-agent: *\nDisallow: /admin\n");
});

test("local: no response asks not to be indexed, not even a 404 or a prerendered page", async ({
  request,
}) => {
  for (const path of ["/", "/no-existe", "/aviso-de-privacidad", "/terminos"]) {
    const response = await request.get(path);
    expect(response.headers()["x-robots-tag"], path).toBeUndefined();
  }
});

test("local: the home page has no deploy footer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("deploy-info")).toHaveCount(0);
  await expect(page.getByText("Versión de prueba")).toHaveCount(0);
});
