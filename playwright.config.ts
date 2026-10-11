// End-to-end tests against the built site served by `astro preview`, which
// runs in workerd. Run them with `vp run e2e`, which builds first.
import { defineConfig, devices } from "@playwright/test";

const port = 4321;

export default defineConfig({
  testDir: "./test/e2e",
  forbidOnly: Boolean(process.env["CI"]),
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    {
      // The site is designed for a 390 px wide phone.
      name: "phone",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // --ignore-lock keeps the server in the foreground, so Playwright owns it.
    // Without it, astro preview moves to the background when it detects a
    // coding agent, and Playwright reports that the server exited early.
    command: `astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env["CI"],
  },
});
