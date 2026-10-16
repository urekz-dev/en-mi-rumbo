// Saving a resident's report about a card (docs/specs/public-directory.md,
// "Report anti-abuse without captcha: honeypot, per-IP quota and pending cap
// per business", "No data is requested or stored about the reporter" and "A
// report changes nothing public"; docs/specs/data-model.md, "The `Report`
// model stores a resident's notice about a card, with no data about the
// sender"). Only a published card of the locality of the page can be
// reported, and a report only adds a row to `reports`: nothing about the card
// changes, and nothing about who sent it is stored, because no column could
// hold it.
//
// Binding: HYPERDRIVE_FRESH, as every write. The card read before the quota is
// a read that leads to a write, so it uses the same fresh connection.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { businesses, type ReportReason } from "../db/schema/index.ts";

/**
 * Unattended reports a card can gather. Past it a report is not saved: the
 * card is already flagged, and the resident is told nothing different.
 */
export const MAX_PENDING_REPORTS = 10;

/**
 * The space of the advisory locks of the reports, the first key of
 * `pg_advisory_xact_lock(int, int)`; the second is the card. Any other use of
 * advisory locks takes another number.
 */
export const REPORTS_LOCK_SPACE = 1;

/** What a report form needs of the card it reports. */
export interface ReportableCard {
  id: string;
  name: string;
}

/** The published card `id` of the locality `localityCode`, or null. */
export async function reportableCard(
  db: Db,
  localityCode: string,
  id: string,
): Promise<ReportableCard | null> {
  const [card] = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, id),
        eq(businesses.localityCode, localityCode),
        eq(businesses.status, "published"),
      ),
    );
  return card ?? null;
}

/** A report to save: the card, the reason and the comment, and nothing else. */
export interface NewReport {
  localityCode: string;
  businessId: string;
  reason: ReportReason;
  /** Trimmed, or null when the resident wrote nothing. */
  comment: string | null;
}

/**
 * What happened to a report: saved; not saved because the card already has
 * MAX_PENDING_REPORTS unattended ones; or not saved because the card is not a
 * published card of the locality (any more).
 */
export type SaveReportOutcome = "saved" | "capped" | "not-found";

/**
 * Saves `report` unless its card is at the cap, without a race window
 * (public-directory, "many reports at the same time"): every report of one
 * card waits for a transaction lock on that card, and then one statement
 * decides the cap and saves the report. READ COMMITTED alone would let
 * simultaneous reports count the same rows; with the lock, each one counts
 * the reports committed before it. The lock is advisory, so it never holds
 * back the panel's changes to the card itself, and it is released with the
 * transaction.
 */
export function saveReport(db: Db, report: NewReport): Promise<SaveReportOutcome> {
  const { localityCode, businessId, reason, comment } = report;
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select 1 from pg_advisory_xact_lock(${REPORTS_LOCK_SPACE}, hashtext(${businessId}))`,
    );
    const { rows } = await tx.execute<{ found: boolean; saved: boolean }>(sql`
      with card as (
        select id, locality_code from businesses
        where id = ${businessId} and locality_code = ${localityCode} and status = 'published'
      ),
      inserted as (
        insert into reports (business_id, locality_code, reason, comment)
        select card.id, card.locality_code, ${reason}::text, ${comment}::text
        from card
        where (
          select count(*) from reports
          where reports.business_id = card.id and reports.status = 'pending'
        ) < ${MAX_PENDING_REPORTS}
        returning 1
      )
      select exists (select 1 from card) as found, exists (select 1 from inserted) as saved
    `);
    const [outcome] = rows;
    if (!outcome?.found) return "not-found";
    return outcome.saved ? "saved" : "capped";
  });
}
