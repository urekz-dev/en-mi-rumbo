// The database of the end-to-end tests, for the ones that add fictitious
// places to it (./unserved-municipality.ts, two-localities/second-locality.ts).
// Only a database on this machine is accepted, the same one the global setup
// migrates and seeds.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../src/core/db/schema/index.ts";
import { isLocalConnectionString, LOCAL_DATABASE_URL } from "../../src/core/db/url.ts";

export async function withDatabase(
  run: (db: NodePgDatabase<typeof schema>) => Promise<void>,
): Promise<void> {
  const url = process.env["DATABASE_URL"] ?? LOCAL_DATABASE_URL;
  if (!isLocalConnectionString(url)) {
    throw new Error("e2e: DATABASE_URL is not a local database; the end-to-end tests change it.");
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await run(drizzle({ client, schema }));
  } finally {
    await client.end();
  }
}
