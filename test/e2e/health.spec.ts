// docs/specs/deployment.md: "Every environment answers a health route (v2)".
// `astro preview` reaches the local database through the Hyperdrive bindings'
// localConnectionString; the failure case is covered by
// test/worker/health.test.ts.
import { expect, test } from "@playwright/test";

test("/health answers ok and is never cached", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.text()).toBe("ok\n");
});
