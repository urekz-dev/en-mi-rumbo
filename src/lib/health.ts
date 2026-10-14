// The health route, /health (ADR 0016): 200 when the Worker reaches the
// database, 503 when it does not. The availability check of production
// requests it every 30 minutes (.github/workflows/monitor.yml). It reads
// through HYPERDRIVE_FRESH, because a cached answer would hide a database that
// is down. The body never says why it failed; the reason goes to the log.
import { sql } from "drizzle-orm";
import { withDb } from "../core/db/client.ts";

const HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

export async function healthResponse(
  env: Pick<Env, "HYPERDRIVE" | "HYPERDRIVE_FRESH">,
  ctx: Pick<ExecutionContext, "waitUntil">,
): Promise<Response> {
  try {
    await withDb(env, "HYPERDRIVE_FRESH", ctx, (db) => db.execute(sql`SELECT 1`));
    return new Response("ok\n", { headers: HEADERS });
  } catch (error) {
    console.error("health: the database did not answer", error);
    return new Response("unavailable\n", { status: 503, headers: HEADERS });
  }
}
