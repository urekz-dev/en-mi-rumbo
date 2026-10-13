// `vp run db:check`: fails when a migration under drizzle/ has a destructive
// statement and no `-- destructive-ok: <reason>` marker. See migration-guard.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMigration, MARKER } from "./migration-guard.ts";

const directory = process.argv[2] ?? "drizzle";
const files = readdirSync(directory, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".sql"))
  .sort();

let failed = false;
for (const file of files) {
  const result = checkMigration(readFileSync(join(directory, file), "utf8"));
  if (!result.ok) {
    failed = true;
    console.error(
      `${file}: destructive statement (${result.statements.join(", ")}). Migrations are ` +
        `additive only; if this is intentional add "-- ${MARKER}: <reason>".`,
    );
  } else if (result.overridden !== null) {
    console.log(`${file}: destructive statement allowed (${result.overridden})`);
  }
}
if (failed) process.exit(1);
console.log(`db:check: ${files.length} migration file(s) checked.`);
