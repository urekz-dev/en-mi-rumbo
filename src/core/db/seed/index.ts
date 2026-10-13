import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Fictitious seed data only, never real businesses or phone numbers. Every
 * insert must be idempotent: use `.onConflictDoNothing()` so the runner can be
 * executed any number of times. The tables arrive with epic B; later stories
 * fill this function.
 */
export async function seed(_db: NodePgDatabase): Promise<void> {}
