// Idempotent seed runner: `vp run db:seed`. Fictitious businesses only
// (src/core/db/seed); reference data ships in the migrations. It never runs
// against prod, and runs against a remote database only when ENVIRONMENT
// names a non-production environment.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/core/db/schema/index.ts";
import { seed, seedSummary } from "../src/core/db/seed/index.ts";
import {
  assertSafeConnectionString,
  isLocalConnectionString,
  LOCAL_DATABASE_URL,
} from "../src/core/db/url.ts";

const url = process.env["DATABASE_URL"] ?? LOCAL_DATABASE_URL;
// Typed as string on purpose: `wrangler types` narrows ENVIRONMENT to the local value.
const environment: string | undefined = process.env["ENVIRONMENT"];

if (environment === "prod") {
  console.log("db:seed: skipped, seeds never run against prod.");
  process.exit(0);
}
if (!isLocalConnectionString(url) && environment !== "dev" && environment !== "stage") {
  console.error(
    "db:seed: refused, DATABASE_URL is not a local database. " +
      "Set ENVIRONMENT=dev or ENVIRONMENT=stage to seed a remote database.",
  );
  process.exit(1);
}
assertSafeConnectionString(url);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const report = await seed(drizzle({ client, schema }));
  for (const line of seedSummary(report)) console.log(line);
  console.log("db:seed: done.");
} finally {
  await client.end();
}
