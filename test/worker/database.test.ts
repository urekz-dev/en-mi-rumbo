import { env, waitUntil } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { withDb } from "../../src/core/db/client.ts";

// Spec "A single database dialect in all environments": the migration tree
// (applied by test/global-setup.ts) gives a PostgreSQL database.
describe("A single database dialect in all environments", () => {
  it("queries PostgreSQL through HYPERDRIVE_FRESH and finds the extensions", async () => {
    const ctx = { waitUntil };
    const rows = await withDb(env, "HYPERDRIVE_FRESH", ctx, async (db) => {
      const result = await db.execute<{ extname: string }>(
        sql`SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent') ORDER BY extname`,
      );
      return result.rows.map((row) => row.extname);
    });
    expect(rows).toEqual(["pg_trgm", "unaccent"]);
  });

  it("runs on PostgreSQL 18 and the extensions work", async () => {
    const ctx = { waitUntil };
    const result = await withDb(env, "HYPERDRIVE", ctx, async (db) => {
      const r = await db.execute<{ v: string; u: string; s: string }>(
        sql`SELECT current_setting('server_version_num')::int / 10000 AS v, unaccent('Tizayuca ñandú café') AS u, similarity('plomeria', 'plomería')::text AS s`,
      );
      return r.rows[0];
    });
    expect(Number(result?.v)).toBeGreaterThanOrEqual(16);
    expect(result?.u).toBe("Tizayuca nandu cafe");
  });
});
