// src/core/db/client.ts: `withDb` closes its client after the callback without
// filling the log. Closing the socket ends pg-cloudflare's read loop with
// "This socket has been closed", which pg reports as a client error; that
// error is the close we asked for, not a problem to log.
import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { withDb } from "../../src/core/db/client.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A context whose `waitUntil` promises the test can await. */
function context() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) },
    settled: async () => {
      await Promise.all(pending);
      // The socket reports its close a few turns after `end()` resolves.
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
  };
}

describe("withDb", () => {
  it("closing the client after a query writes nothing to the log", async () => {
    const errors = vi.spyOn(console, "error");
    const { ctx, settled } = context();

    const value = await withDb(env, "HYPERDRIVE_FRESH", ctx, async (db) => {
      const result = await db.execute<{ one: number }>(sql`SELECT 1 AS one`);
      return result.rows[0]?.one;
    });
    await settled();

    expect(value).toBe(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it("a failed connection is still reported to the caller", async () => {
    const { ctx, settled } = context();
    const unreachable = {
      connectionString: "postgres://enmirumbo:enmirumbo@127.0.0.1:1/none",
    } as unknown as Hyperdrive;

    await expect(
      withDb({ ...env, HYPERDRIVE_FRESH: unreachable }, "HYPERDRIVE_FRESH", ctx, async () => 1),
    ).rejects.toThrow();
    await settled();
  });
});
