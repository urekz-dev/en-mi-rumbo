// Scenarios of docs/specs/deployment.md, requirement "Every environment
// answers a health route (v2)". src/pages/health.ts serves healthResponse; the
// end-to-end tests request /health through the build.
import { env, waitUntil } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { healthResponse } from "../../src/lib/health.ts";

const ctx = { waitUntil };
// Nothing listens on port 1, so connecting fails at once.
const unreachable = {
  connectionString: "postgres://enmirumbo:enmirumbo@127.0.0.1:1/none",
} as unknown as Hyperdrive;

describe("Every environment answers a health route (v2)", () => {
  it("answers 200 ok when the database answers", async () => {
    const response = await healthResponse(env, ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok\n");
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers 503 without details when the database does not answer", async () => {
    const response = await healthResponse({ ...env, HYPERDRIVE_FRESH: unreachable }, ctx);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("unavailable\n");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reads through HYPERDRIVE_FRESH, never the cached binding", async () => {
    const cachedDown = await healthResponse({ ...env, HYPERDRIVE: unreachable }, ctx);
    expect(cachedDown.status).toBe(200);

    const freshDown = await healthResponse({ ...env, HYPERDRIVE_FRESH: unreachable }, ctx);
    expect(freshDown.status).toBe(503);
  });
});
