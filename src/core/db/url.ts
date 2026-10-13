// Rules for database connection strings that need no Workers runtime, so Node
// scripts, Drizzle Kit and the Worker share them.
import pg from "pg";

export const LOCAL_DATABASE_URL = "postgres://enmirumbo:enmirumbo@localhost:5432/enmirumbo";

export const LOCAL_TEST_DATABASE_URL =
  "postgres://enmirumbo:enmirumbo@localhost:5432/enmirumbo_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * The host the driver would connect to. It asks `pg` itself, so a `host`
 * parameter hiding in the query string cannot make a remote address look
 * local. Returns undefined when the string cannot be interpreted.
 */
export function effectiveHost(connectionString: string): string | undefined {
  try {
    // Building a Client parses the string without opening a connection.
    const host = new pg.Client(connectionString).host;
    return typeof host === "string" && host !== "" ? host : undefined;
  } catch {
    return undefined;
  }
}

/** Local means the machine running the process. Anything unclear is remote. */
export function isLocalConnectionString(connectionString: string): boolean {
  const host = effectiveHost(connectionString);
  if (host === undefined) return false;
  // A leading slash is a Unix socket directory.
  return LOCAL_HOSTS.has(host.toLowerCase()) || host.startsWith("/");
}

function sslMode(connectionString: string): string | null {
  try {
    return new URL(connectionString).searchParams.get("sslmode");
  } catch {
    return null;
  }
}

/**
 * Throws unless the connection stays on this machine or uses TLS with
 * certificate verification (`sslmode=verify-full`). The message never includes
 * the connection string, so it cannot leak the password.
 */
export function assertSafeConnectionString(connectionString: string): void {
  if (isLocalConnectionString(connectionString)) return;
  if (sslMode(connectionString) === "verify-full") return;
  throw new Error(
    "DATABASE_URL points to a database that is not on this machine and does not set " +
      "sslmode=verify-full. Connections that leave the machine must use TLS with " +
      "certificate verification.",
  );
}
