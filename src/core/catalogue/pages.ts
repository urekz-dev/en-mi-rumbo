// The catalogue entries that the pages of a locality are made of
// (docs/specs/public-directory.md, "Category listing at a clean URL with the
// catalogue slug", "Indexable trade page at the root, generated from the
// closed catalogue" and "Indexable trade and zone page"): what one path
// segment under `/{estado}/{municipio}/` names, read with the order of
// `readSegment`; the name each zone of a locality is shown with
// (`zoneDisplayNames`); and the categories, whose listings the sitemap lists.
//
// Binding: the public pages and the sitemap run these on HYPERDRIVE, the
// cached binding of public reads ("Public pages may show a change up to a
// minute late (v2)").
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import type { Db } from "../db/client.ts";
import { categories, trades, zones } from "../db/schema/index.ts";
import { isSlug, type ServedLocality } from "../locality/served.ts";
import { type CatalogueEntry, readSegment, type SegmentPage, segmentSplits } from "./root-urls.ts";
import { zoneDisplayNames, type ZoneNames } from "./zone-names.ts";

/** A catalogue entry with the id the listings filter by. */
export interface PageEntry extends CatalogueEntry {
  id: number;
}

/** The page a segment of a locality names. */
export type LocalitySegment = SegmentPage<PageEntry>;

/**
 * The longest segment worth reading. The longest page of the catalogues today
 * is far shorter (test/worker/root-urls.test.ts checks every one fits), and a
 * cap keeps a segment of thousands of hyphens from costing thousands of
 * lookups.
 */
export const MAX_SEGMENT_LENGTH = 160;

/**
 * The page that `segment` names in the locality `localityCode`, or null: a
 * category, a trade, or a trade and one of the locality's zones, hidden ones
 * included, since a slug never changes. A segment that cannot be a slug
 * (capitals, accents, `%`, `..`) never reaches the database. One query, for
 * only the slugs the segment and its cuts name.
 */
export async function localitySegment(
  db: Db,
  localityCode: string,
  segment: string,
): Promise<LocalitySegment | null> {
  if (segment.length > MAX_SEGMENT_LENGTH || !isSlug(segment)) return null;
  const splits = segmentSplits(segment);
  // Slugs are unique in each catalogue, so each slug matches one entry at most.
  const rows = await unionAll(
    db
      .select({
        kind: sql<string>`'category'`,
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(categories)
      .where(eq(categories.slug, segment)),
    db
      .select({ kind: sql<string>`'trade'`, id: trades.id, name: trades.name, slug: trades.slug })
      .from(trades)
      .where(inArray(trades.slug, [segment, ...splits.map(({ trade }) => trade)])),
    db
      .select({ kind: sql<string>`'zone'`, id: zones.id, name: zones.name, slug: zones.slug })
      .from(zones)
      .where(
        and(
          eq(zones.localityCode, localityCode),
          inArray(
            zones.slug,
            splits.map(({ zone }) => zone),
          ),
        ),
      ),
  );
  const of = (kind: string): PageEntry[] =>
    rows.filter((row) => row.kind === kind).map(({ id, name, slug }) => ({ id, name, slug }));
  return readSegment(segment, {
    categories: of("category"),
    trades: of("trade"),
    zones: of("zone"),
  });
}

/** The zone of the locality `localityCode` with `slug`, hidden ones included, or null. */
export async function localityZone(
  db: Db,
  localityCode: string,
  slug: string,
): Promise<PageEntry | null> {
  if (!isSlug(slug)) return null;
  const [zone] = await db
    .select({ id: zones.id, name: zones.name, slug: zones.slug })
    .from(zones)
    .where(and(eq(zones.localityCode, localityCode), eq(zones.slug, slug)));
  return zone ?? null;
}

/**
 * The name each zone of `locality` is shown with, by slug: its name, or its
 * name and its type when another zone of the locality, hidden ones included,
 * or the locality itself has the same name. One query.
 */
export async function localityZoneNames(
  db: Db,
  locality: Pick<ServedLocality, "code" | "name">,
): Promise<ZoneNames> {
  const rows = await db
    .select({ slug: zones.slug, name: zones.name, type: zones.type })
    .from(zones)
    .where(eq(zones.localityCode, locality.code));
  return zoneDisplayNames(rows, locality.name);
}

/** Every category, in catalogue order: each has its listing in every locality. */
export function allCategories(db: Db): Promise<PageEntry[]> {
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .orderBy(asc(categories.id));
}
