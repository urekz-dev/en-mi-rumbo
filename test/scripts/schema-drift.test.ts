// docs/specs/data-model.md, requirement "The migration tree applies in full and
// its constraints survive", scenario "the full tree on an empty database": the
// schema the migrations build does not differ from the one declared in
// src/core/db/schema. Drizzle Kit generates against a copy of drizzle/; a
// change in the schema without its migration would produce a new file.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vite-plus/test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// Drizzle Kit takes the output folder relative to the working directory.
const WORK = "node_modules/.cache/schema-drift";

afterAll(() => {
  rmSync(join(ROOT, WORK), { recursive: true, force: true });
});

describe("The migration tree applies in full and its constraints survive", () => {
  it("the declared schema has no change without its migration", () => {
    rmSync(join(ROOT, WORK), { recursive: true, force: true });
    mkdirSync(join(ROOT, WORK), { recursive: true });
    cpSync(join(ROOT, "drizzle"), join(ROOT, WORK, "drizzle"), { recursive: true });
    const before = readdirSync(join(ROOT, WORK, "drizzle")).sort();

    const result = spawnSync(
      join(ROOT, "node_modules/.bin/drizzle-kit"),
      [
        "generate",
        "--dialect=postgresql",
        "--schema=./src/core/db/schema/index.ts",
        `--out=${WORK}/drizzle`,
      ],
      { cwd: ROOT, encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(join(ROOT, WORK, "drizzle")).sort()).toEqual(before);
    expect(result.stdout).toContain("No schema changes");
  }, 60_000);
});
