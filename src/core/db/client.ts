// One Drizzle instance per request over a new `pg` client (ADR 0005). The
// client is closed with `ctx.waitUntil` once the callback has finished, so
// closing never delays the response and never cuts a query in flight.
//
// Choose the binding on purpose:
// - HYPERDRIVE is cached for 60 seconds and never invalidated by writes. Use it
//   only for public reads that tolerate stale data.
// - HYPERDRIVE_FRESH has caching disabled. Use it for writes, the admin panel,
//   verification flows and any read that follows a write.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema/index.ts";

export type DbBinding = "HYPERDRIVE" | "HYPERDRIVE_FRESH";
export type Db = NodePgDatabase<typeof schema>;

export async function withDb<T>(
  env: Pick<Env, DbBinding>,
  binding: DbBinding,
  ctx: Pick<ExecutionContext, "waitUntil">,
  run: (db: Db) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: env[binding].connectionString });
  let closing = false;
  // An idle client emits "error" when the server drops it; without a listener
  // that would crash the request. Once we close the client, closing the socket
  // ends pg-cloudflare's read loop with "This socket has been closed", which
  // arrives here too: that is our own close, not something to log.
  client.on("error", (error) => {
    if (!closing) console.error("db: client error", error);
  });
  try {
    await client.connect();
    return await run(drizzle({ client, schema }));
  } finally {
    closing = true;
    // end() never rejects the request: a failed close is only logged.
    ctx.waitUntil(client.end().catch((error: unknown) => console.error("db: close failed", error)));
  }
}
