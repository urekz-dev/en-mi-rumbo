// End-to-end tests against the built site served by `astro preview`, which
// runs in workerd. Run them with `vp run e2e`, which builds first.
import { defineConfig, devices } from "@playwright/test";
import { LOCAL_DATABASE_URL } from "./src/core/db/url.ts";

// E2E_PORT lets parallel worktrees run their end-to-end tests at once: outside
// CI, Playwright reuses a server already listening on its port, which would be
// another worktree's.
const port = Number(process.env["E2E_PORT"] ?? 4321);

// The preview reaches the database through the Hyperdrive bindings, and the
// global setup (test/e2e/global-setup.ts) migrates and seeds it: both use
// DATABASE_URL, or the local development database when it is unset.
const databaseUrl = process.env["DATABASE_URL"] ?? LOCAL_DATABASE_URL;
for (const binding of ["HYPERDRIVE", "HYPERDRIVE_FRESH"]) {
  process.env[`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${binding}`] = databaseUrl;
}

const PHONE = { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } };

export default defineConfig({
  testDir: "./test/e2e",
  globalSetup: "./test/e2e/global-setup.ts",
  forbidOnly: Boolean(process.env["CI"]),
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    {
      // The site is designed for a 390 px wide phone. The seed leaves one
      // active locality, Tizayuca.
      name: "phone",
      use: PHONE,
      testIgnore: "two-localities/**",
    },
    // The same site with a second, fictitious active locality
    // (test/e2e/two-localities/): the list of localities at the root, the
    // locality cookie and the link to change municipality, and the crawls
    // again, now through the list. It runs after "phone", whose tests expect
    // Tizayuca alone, and its teardown removes the second locality.
    {
      name: "second locality",
      testMatch: "two-localities/second-locality.setup.ts",
      dependencies: ["phone"],
      teardown: "no second locality",
    },
    {
      name: "no second locality",
      testMatch: "two-localities/second-locality.teardown.ts",
    },
    {
      name: "phone, two localities",
      use: PHONE,
      dependencies: ["second locality"],
      testMatch: ["two-localities/*.spec.ts", "surfaces.spec.ts", "internal-links.spec.ts"],
    },
  ],
  webServer: {
    // --ignore-lock keeps the server in the foreground, so Playwright owns it.
    // Without it, astro preview moves to the background when it detects a
    // coding agent, and Playwright reports that the server exited early.
    command: `astro preview --port ${port} --ignore-lock`,
    // Playwright starts the server before the global setup migrates the
    // database, so readiness is a route that needs no database.
    url: `http://localhost:${port}/robots.txt`,
    reuseExistingServer: !process.env["CI"],
  },
});
