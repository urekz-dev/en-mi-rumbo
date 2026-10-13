// Drizzle Kit reads DATABASE_URL, a direct connection string (never a
// Hyperdrive one). Without it, it uses the local Docker database. A database
// that is not on this machine needs `sslmode=verify-full`.
import { defineConfig } from "drizzle-kit";
import { assertSafeConnectionString, LOCAL_DATABASE_URL } from "./src/core/db/url.ts";

const url = process.env["DATABASE_URL"] ?? LOCAL_DATABASE_URL;
assertSafeConnectionString(url);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/core/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
