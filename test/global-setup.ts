// Vitest global setup (Node side): applies the migrations to the database the
// workers tests reach through the Hyperdrive bindings. CI provides PostgreSQL
// 18 on localhost:5432 and sets DATABASE_URL; locally it defaults to the
// enmirumbo_test database of compose.yaml, never the development one.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { assertSafeConnectionString, LOCAL_TEST_DATABASE_URL } from "../src/core/db/url.ts";

export default async function setup(): Promise<void> {
  const url = process.env["DATABASE_URL"] ?? LOCAL_TEST_DATABASE_URL;
  assertSafeConnectionString(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
}
