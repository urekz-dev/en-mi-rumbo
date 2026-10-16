// The directory search (docs/specs/public-directory.md, "The search covers
// name, keywords and trades, and only what is published", "Case- and
// accent-insensitive matching, and partial by word stem", "Empty query and
// hostile terms bounded, without error" and "Results page with the same cards
// as the listing").
//
// Binding: the public search page runs this on HYPERDRIVE, the cached binding
// of public reads. Its results may be up to 60 seconds old, so a card the
// admin unpublishes can stay in them for up to a minute; the spec allows it
// ("Public pages may show a change up to a minute late (v2)") and the panel
// says so after each change.
import { and, asc, eq, exists, like, or, type SQL, sql, type SQLWrapper } from "drizzle-orm";
import type { ListingBusiness } from "../business/listing.ts";
import type { Db } from "../db/client.ts";
import { businesses, businessTrades, categories, trades, zones } from "../db/schema/index.ts";
import { searchTerms } from "./normalize.ts";

/** The locality the search runs in, as the page resolved it from the path. */
export interface SearchLocality {
  code: string;
  /** Its name from the locality record: its words are filler words. */
  name: string;
}

/** What a listing card shows, and nothing else: the results use the listing's card. */
export type SearchResult = ListingBusiness;

/**
 * Escapes the LIKE wildcards and the escape character itself. PostgreSQL's
 * default LIKE escape character is the backslash. The stems are already
 * `[a-z0-9]`, so this is a second line of defence, not the first.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/**
 * The trade names are not stored normalized, so the query normalizes them with
 * `search_normalize`, the same SQL function the generated search columns use.
 */
export function normalizedSql(text: SQLWrapper): SQL<string> {
  return sql<string>`search_normalize(${text})`;
}

/**
 * The published cards of `locality` that match `query`, the `slice` of them a
 * page reads (`pageSlice`, src/core/pagination.ts), or null when nothing
 * searchable remains (an empty, blank or only-symbols query): then no query
 * runs, and the page shows the empty-query notice instead of the directory.
 *
 * Each stem from `searchTerms` must appear, as a substring, in the normalized
 * name, in the normalized "¿Qué ofreces?" or in the normalized name of one of
 * the trades the admin assigned; different stems may match in different
 * places. There is no ranking: the order is the listing's, most recently
 * published first, then by name, then by id so that it never changes between
 * two identical searches, which is also what lets a page continue where the
 * previous one ended.
 */
export async function searchPublishedBusinesses(
  db: Db,
  locality: SearchLocality,
  query: string,
  slice: { limit: number; offset: number },
): Promise<SearchResult[] | null> {
  const terms = searchTerms(query, locality.name);
  if (terms.length === 0) return null;

  const matches = (term: string) => {
    const pattern = `%${escapeLike(term)}%`;
    const byTrade = db
      .select({ one: sql`1` })
      .from(businessTrades)
      .innerJoin(trades, eq(trades.id, businessTrades.tradeId))
      .where(
        and(
          eq(businessTrades.businessId, businesses.id),
          like(normalizedSql(trades.name), pattern),
        ),
      );
    return or(
      like(businesses.nameNormalized, pattern),
      like(businesses.whatYouOfferNormalized, pattern),
      exists(byTrade),
    );
  };

  return db
    .select({
      id: businesses.id,
      name: businesses.name,
      categorySlug: categories.slug,
      zoneName: sql<string | null>`coalesce(${zones.name}, ${businesses.zoneOther})`,
      zoneSlug: zones.slug,
      homeDelivery: businesses.homeDelivery,
      whatsapp: businesses.whatsapp,
      photoKey: businesses.photoKey,
    })
    .from(businesses)
    .innerJoin(categories, eq(categories.id, businesses.categoryId))
    .leftJoin(zones, eq(zones.id, businesses.zoneId))
    .where(
      and(
        eq(businesses.localityCode, locality.code),
        eq(businesses.status, "published"),
        ...terms.map(matches),
      ),
    )
    .orderBy(
      sql`${businesses.publishedAt} DESC NULLS LAST`,
      asc(businesses.name),
      asc(businesses.id),
    )
    .limit(slice.limit)
    .offset(slice.offset);
}
