// Recomputes the search columns of the businesses already saved
// (docs/specs/data-model.md, scenarios "cards that already existed become
// findable" and "the backfill can be repeated"). `vp run db:backfill:search`
// runs it; it also repairs a row that some write path left out of sync.
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { businesses } from "../db/schema/index.ts";
import { searchColumns } from "./normalize.ts";

const BATCH_SIZE = 500;

export interface BackfillResult {
  /** Businesses read. */
  checked: number;
  /** Businesses whose search columns were rewritten. */
  updated: number;
}

/**
 * Idempotent: it recomputes with `searchColumns`, the function every write
 * path uses, and writes only the rows whose stored values differ, and only
 * the two search columns. Each update also requires the name and "¿Qué
 * ofreces?" it read, so a business saved in between is left as its own save
 * wrote it. Rows are read in batches by id, never all at once.
 */
export async function backfillSearchColumns(db: Db): Promise<BackfillResult> {
  const result: BackfillResult = { checked: 0, updated: 0 };
  let after = "";
  for (;;) {
    const rows = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        whatYouOffer: businesses.whatYouOffer,
        nameNormalized: businesses.nameNormalized,
        whatYouOfferNormalized: businesses.whatYouOfferNormalized,
      })
      .from(businesses)
      .where(gt(businesses.id, after))
      .orderBy(asc(businesses.id))
      .limit(BATCH_SIZE);
    if (rows.length === 0) return result;

    for (const row of rows) {
      const expected = searchColumns(row.name, row.whatYouOffer);
      if (
        row.nameNormalized === expected.nameNormalized &&
        row.whatYouOfferNormalized === expected.whatYouOfferNormalized
      ) {
        continue;
      }
      const written = await db
        .update(businesses)
        .set(expected)
        .where(
          and(
            eq(businesses.id, row.id),
            eq(businesses.name, row.name),
            sql`${businesses.whatYouOffer} IS NOT DISTINCT FROM ${row.whatYouOffer}`,
          ),
        )
        .returning({ id: businesses.id });
      result.updated += written.length;
    }
    result.checked += rows.length;
    after = rows[rows.length - 1]!.id;
  }
}
