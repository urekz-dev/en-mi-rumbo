import { mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { checkMigration } from "../../scripts/migration-guard.ts";

describe("migration guard", () => {
  it("accepts additive migrations", () => {
    const sql = `CREATE TABLE "t" ("id" serial PRIMARY KEY);
ALTER TABLE "t" ADD COLUMN "name" text;
CREATE INDEX "t_name_idx" ON "t" ("name");
CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
    expect(checkMigration(sql)).toEqual({ ok: true, overridden: null });
  });

  it.each([
    ["DROP", 'ALTER TABLE "t" DROP COLUMN "name";'],
    ["DROP", 'drop table "t";'],
    ["RENAME", 'ALTER TABLE "t" RENAME COLUMN "a" TO "b";'],
    ["RENAME", 'ALTER TABLE "t" RENAME TO "u";'],
    ["ALTER ... TYPE", 'ALTER TABLE "t" ALTER COLUMN "a" SET DATA TYPE integer;'],
    ["ALTER ... TYPE", 'ALTER TABLE "t" ALTER COLUMN "a" TYPE integer USING "a"::integer;'],
    ["SET NOT NULL", 'ALTER TABLE "t" ALTER COLUMN "a" SET NOT NULL;'],
    ["TRUNCATE", 'TRUNCATE TABLE "t";'],
  ])("rejects %s", (name, sql) => {
    const result = checkMigration(sql);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statements).toContain(name);
  });

  it("allows a destructive statement with a marker and a reason", () => {
    const sql = `-- destructive-ok: column unused since v0.4.0\nALTER TABLE "t" DROP COLUMN "name";`;
    expect(checkMigration(sql)).toEqual({
      ok: true,
      overridden: "column unused since v0.4.0",
    });
  });

  it("rejects a marker without a reason", () => {
    expect(checkMigration('-- destructive-ok:\nDROP TABLE "t";').ok).toBe(false);
    expect(checkMigration('-- destructive-ok:   \nDROP TABLE "t";').ok).toBe(false);
  });

  it("ignores keywords in comments, strings and quoted identifiers", () => {
    const sql = `-- we will drop nothing here
/* TRUNCATE is not used */
INSERT INTO "t" ("note") VALUES ('do not DROP or RENAME');
ALTER TABLE "t" ADD COLUMN "drop" text;`;
    expect(checkMigration(sql).ok).toBe(true);
  });

  it("does not take ALTER TYPE ... ADD VALUE for a type change", () => {
    expect(checkMigration("ALTER TYPE mood ADD VALUE 'ok';").ok).toBe(true);
  });
});

describe("db:check script", () => {
  const run = (sql: string) => {
    const directory = mkdtempSync(join(tmpdir(), "guard-"));
    writeFileSync(join(directory, "0001_x.sql"), sql);
    return spawnSync("node", ["scripts/check-migrations.ts", directory], { encoding: "utf8" });
  };

  it("fails with a non-zero exit code on an unmarked destructive migration", () => {
    const result = run('DROP TABLE "t";');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("0001_x.sql");
  });

  it("passes with a marker", () => {
    expect(run('-- destructive-ok: replaced by u\nDROP TABLE "t";').status).toBe(0);
  });

  it("passes on the repository's real migrations", () => {
    expect(spawnSync("node", ["scripts/check-migrations.ts"], { encoding: "utf8" }).status).toBe(0);
  });
});
