// docs/specs/deployment.md, requirement "The commands that write in bulk read
// the environment from `ENVIRONMENT` (v2)": scripts/db-backfill-search.ts
// refuses a remote database before it connects. What the backfill writes is
// tested inside workerd, in test/worker/search.test.ts.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("The commands that write in bulk read the environment from `ENVIRONMENT` (v2)", () => {
  it("search backfill pointing to a remote database", () => {
    // A clean environment, without ENVIRONMENT. `wrangler types` declares the
    // Worker vars as required on ProcessEnv, hence Object.assign.
    const env: NodeJS.ProcessEnv = Object.assign(Object.create(null) as NodeJS.ProcessEnv, {
      PATH: process.env["PATH"] ?? "/usr/bin:/bin",
      DATABASE_URL: "postgres://u:p@db.example.com/enmirumbo?sslmode=verify-full",
    });
    const run = spawnSync(process.execPath, ["scripts/db-backfill-search.ts"], {
      cwd: ROOT,
      encoding: "utf8",
      env,
      timeout: 30_000,
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("refused, DATABASE_URL is not a local database");
    expect(run.stderr).toContain("ENVIRONMENT=prod");
    expect(run.stdout).not.toContain("checked");
  });
});
