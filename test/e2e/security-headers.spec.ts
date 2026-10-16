// Scenarios of docs/specs/deployment.md on the built site, served by `astro
// preview` in workerd: "Every response carries the security headers and the
// content security policy (v2)", "Every site response carries the basic
// security headers" and "The site declares where JavaScript may come from and
// where data may go". The Worker adds the headers to its responses
// (src/worker.ts) and `_headers` to the static assets
// (src/integrations/static-headers.ts), which the preview applies as
// Cloudflare does. Locally the measurement is off, so the policy allows no
// Umami origin; its production variants are covered by
// test/worker/security-headers.test.ts.
import { expect, test } from "@playwright/test";

const POLICY =
  "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; " +
  "img-src 'self'; connect-src 'self'; frame-src https://challenges.cloudflare.com; " +
  "frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";

test("every kind of response carries the security headers and no framework banner", async ({
  request,
}) => {
  const page = await request.get("/terminos");
  const stylesheet = /href="(\/_astro\/[^"]+\.css)"/.exec(await page.text())?.[1];
  expect(stylesheet).toBeDefined();
  for (const path of [
    "/", // the redirect to the only active locality
    "/hidalgo/tizayuca", // a page of the Worker
    "/no-existe", // a 404
    "/hidalgo/no-existe", // a 404 under an unknown locality
    "/robots.txt",
    "/sitemap.xml",
    "/health",
    "/aviso-de-privacidad", // a prerendered page, a static asset
    stylesheet ?? "", // a hashed static asset
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect.soft(headers["content-security-policy"], path).toBe(POLICY);
    expect.soft(headers["x-content-type-options"], path).toBe("nosniff");
    expect.soft(headers["x-frame-options"], path).toBe("DENY");
    expect.soft(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect.soft(headers["x-powered-by"], path).toBeUndefined();
    if ((headers["content-type"] ?? "").startsWith("text/html")) {
      expect.soft(await response.text(), path).not.toMatch(/<meta name="generator"/i);
    }
  }
});

// Scenario: the admin panel keeps its strict policy
test("the panel keeps its strict referrer policy and may send its forms to the Access login", async ({
  request,
}) => {
  for (const path of ["/admin", "/admin/registros/1/loquesea"]) {
    const headers = (await request.get(path)).headers();
    expect.soft(headers["referrer-policy"], path).toBe("strict-origin");
    expect
      .soft(headers["content-security-policy"], path)
      .toBe(
        POLICY.replace(
          "form-action 'self'",
          "form-action 'self' https://urekz.cloudflareaccess.com",
        ),
      );
    expect.soft(headers["x-frame-options"], path).toBe("DENY");
  }
});

// Scenario: analytics measurement works with the policy in place (its local
// half: the pages load whole under the policy, without violations)
test("the pages load whole under the policy, without a single violation", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  for (const path of ["/hidalgo/tizayuca", "/aviso-de-privacidad", "/no-existe", "/admin"]) {
    await page.goto(path);
    // The stylesheet applied: the body takes the system font of the tokens.
    expect
      .soft(await page.evaluate(() => getComputedStyle(document.body).fontFamily), path)
      .toMatch(/^system-ui,/);
  }
  expect(violations).toEqual([]);
});

// Scenario: a script from another origin
test("the browser blocks a script from another origin", async ({ page }) => {
  await page.goto("/aviso-de-privacidad");
  const blocked = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener("securitypolicyviolation", (event) =>
          resolve(event.effectiveDirective),
        );
        const script = document.createElement("script");
        script.src = "https://cdn.example.com/script.js";
        document.head.appendChild(script);
      }),
  );
  expect(blocked).toBe("script-src-elem");
});
