// Search backfill: `vp run db:backfill:search`. Recomputes the normalized name
// and "¿Qué ofreces?" of every business (src/core/search/backfill.ts), writing
// only the rows that differ and only those two columns, so it is safe to run
// again. It runs against a remote database only when ENVIRONMENT names the
// deployed environment it targets. Unlike the seed it may run against prod:
// recomputing derived columns is what makes existing cards findable there.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/core/db/schema/index.ts";
import {
  assertSafeConnectionString,
  isLocalConnectionString,
  LOCAL_DATABASE_URL,
} from "../src/core/db/url.ts";
import { backfillSearchColumns } from "../src/core/search/backfill.ts";

const url = process.env["DATABASE_URL"] ?? LOCAL_DATABASE_URL;
// Typed as string on purpose: `wrangler types` narrows ENVIRONMENT to the local value.
const environment: string | undefined = process.env["ENVIRONMENT"];
const deployed = ["dev", "stage", "prod"];

if (!isLocalConnectionString(url) && !deployed.includes(environment ?? "")) {
  console.error(
    "db:backfill:search: refused, DATABASE_URL is not a local database and nothing changed. " +
      "Set ENVIRONMENT=dev, ENVIRONMENT=stage or ENVIRONMENT=prod to backfill a remote database.",
  );
  process.exit(1);
}
assertSafeConnectionString(url);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { checked, updated } = await backfillSearchColumns(drizzle({ client, schema }));
  console.log(`db:backfill:search: checked ${checked} businesses, updated ${updated}.`);
} finally {
  await client.end();
}
