// The listing pages of a locality, `/{estado}/{municipio}/<segment>`
// (docs/specs/public-directory.md): the listing of a category, with its zone
// filter (`?colonia=<zone>`), the page of a trade and the page of a trade in a
// zone, each 20 cards a page (`?pagina=<n>`). What the route
// src/pages/[state]/[municipality]/[segment].astro renders, decided here
// apart from Astro (ADR 0019):
//
// - Which page a segment names (`localitySegment`): first a category, then a
//   trade, then a trade and zone pair; anything else is no page.
// - Which cards it lists (only published cards of the locality, in the
//   listings' order) and which zones it offers (only those with cards). A
//   zone is shown with its display name (src/core/catalogue/zone-names.ts)
//   on the cards, in the zone navigation and in a trade and zone page's
//   texts.
// - Whether search engines may index it, and its canonical path: a trade page
//   without published cards is not indexed, has no canonical and is never
//   linked; a category listing filtered by a zone names the listing without
//   the filter; any other page names itself, with its page number after the
//   first.
// - Where "Ver más" leads, and that a page past the last is no page.
import type { PageEntry } from "../catalogue/pages.ts";
import { localitySegment, localityZone, localityZoneNames } from "../catalogue/pages.ts";
import { withZoneName, type ZoneNames } from "../catalogue/zone-names.ts";
import type { Db } from "../db/client.ts";
import { localityPath } from "../locality/paths.ts";
import type { ServedLocality } from "../locality/served.ts";
import { categoryTexts, tradeTexts, tradeZoneTexts } from "../seo/listing.ts";
import {
  hasListedBusinesses,
  type ListingBusiness,
  type ListingScope,
  listedBusinesses,
  listedZones,
} from "./listing.ts";

/** The query parameter of the zone filter of a category listing: `?colonia=<zone slug>`. */
export const ZONE_PARAM = "colonia";

/** The query parameter of a page after the first: `?pagina=<n>`. */
export const PAGE_PARAM = "pagina";

/** What the query of a listing asks for, already read. */
export interface ListingQuery {
  /** The page, from `parsePage`. */
  page: number;
  /** The `colonia` of a category listing, as written, or null. */
  zone: string | null;
}

/** One option of the zone navigation. */
export interface ZoneOption {
  name: string;
  path: string;
  /** Whether it is the page being shown. */
  current: boolean;
}

/** The zone navigation of a listing: "Todas las colonias" and one option per zone. */
export interface ZoneNav {
  all: { path: string; current: boolean };
  zones: ZoneOption[];
}

/** Why a listing lists nothing, and the way out it offers. */
export type EmptyListing =
  /** A category without published cards. */
  | { kind: "category" }
  /** A category with cards, none in the zone of the filter: back to the whole listing. */
  | { kind: "category-zone"; allZonesPath: string }
  /** A trade without published cards in the locality. */
  | { kind: "trade" }
  /** A trade without cards in the zone: back to the trade's page, unless it is empty too. */
  | { kind: "trade-zone"; allZonesPath: string | null };

export interface ListingPage {
  kind: "category" | "trade" | "trade+zone";
  /** The only `h1`, which is also the page's title. */
  heading: string;
  description: string;
  /** Whether search engines may index it; when not, it has no canonical. */
  indexable: boolean;
  /** Its canonical path, or null when it must not be indexed. */
  canonicalPath: string | null;
  /** Null when no zone has published cards of the page. */
  zoneNav: ZoneNav | null;
  businesses: ListingBusiness[];
  /** Null when the page lists cards. */
  empty: EmptyListing | null;
  /** The next page, or null on the last. */
  nextPath: string | null;
}

/** `path` with the zone filter and the page number, page 1 without one. */
export function listingPath(
  path: string,
  { zone = null, page = 1 }: Partial<ListingQuery>,
): string {
  const query = new URLSearchParams();
  if (zone !== null) query.set(ZONE_PARAM, zone);
  if (page > 1) query.set(PAGE_PARAM, String(page));
  const search = query.toString();
  return search === "" ? path : `${path}?${search}`;
}

/** The zone navigation, or null without options: a filter with one way out is a dead control. */
function zoneNav(
  allPath: string,
  zones: readonly { name: string; slug: string }[],
  names: ZoneNames,
  current: string | null,
  pathOf: (zone: string) => string,
): ZoneNav | null {
  if (zones.length === 0) return null;
  return {
    all: { path: allPath, current: current === null },
    zones: zones.map(({ name, slug }) => ({
      name: names.get(slug) ?? name,
      path: pathOf(slug),
      current: slug === current,
    })),
  };
}

async function categoryPage(
  db: Db,
  locality: ServedLocality,
  category: PageEntry,
  query: ListingQuery,
): Promise<ListingPage | null> {
  const scope: ListingScope = { localityCode: locality.code, categoryId: category.id };
  // A zone that is not in the catalogue of the locality is ignored.
  const zone = query.zone === null ? null : await localityZone(db, locality.code, query.zone);
  const rows = await listedBusinesses(db, { ...scope, zoneId: zone?.id ?? null }, query.page);
  if (query.page > 1 && rows.businesses.length === 0) return null;
  const path = localityPath(locality, category.slug);
  const zoneSlug = zone?.slug ?? null;
  const names = await localityZoneNames(db, locality);
  return {
    kind: "category",
    ...categoryTexts(category, locality),
    indexable: true,
    // The filtered listing names the listing without the filter, so it competes
    // neither with the trade and zone pages nor with itself.
    canonicalPath: zone === null ? listingPath(path, { page: query.page }) : path,
    zoneNav: zoneNav(path, await listedZones(db, scope), names, zoneSlug, (slug) =>
      listingPath(path, { zone: slug }),
    ),
    businesses: rows.businesses.map((business) => withZoneName(business, names)),
    empty:
      rows.businesses.length > 0
        ? null
        : zone === null
          ? { kind: "category" }
          : { kind: "category-zone", allZonesPath: path },
    nextPath: rows.hasNext ? listingPath(path, { zone: zoneSlug, page: query.page + 1 }) : null,
  };
}

async function tradePage(
  db: Db,
  locality: ServedLocality,
  trade: PageEntry,
  zone: PageEntry | null,
  query: ListingQuery,
): Promise<ListingPage | null> {
  const scope: ListingScope = { localityCode: locality.code, tradeId: trade.id };
  const rows = await listedBusinesses(db, { ...scope, zoneId: zone?.id ?? null }, query.page);
  if (query.page > 1 && rows.businesses.length === 0) return null;
  const tradePath = localityPath(locality, trade.slug);
  const path = zone === null ? tradePath : localityPath(locality, `${trade.slug}-${zone.slug}`);
  const zones = await listedZones(db, scope);
  const names = await localityZoneNames(db, locality);
  // A page without published cards is not indexed and never linked.
  const indexable = rows.businesses.length > 0;
  let empty: EmptyListing | null = null;
  if (!indexable && zone === null) empty = { kind: "trade" };
  if (!indexable && zone !== null) {
    // "Ver todas las colonias" leads only to a trade page that lists cards.
    const tradeHasCards = zones.length > 0 || (await hasListedBusinesses(db, scope));
    empty = { kind: "trade-zone", allZonesPath: tradeHasCards ? tradePath : null };
  }
  return {
    kind: zone === null ? "trade" : "trade+zone",
    ...(zone === null
      ? tradeTexts(trade, locality)
      : tradeZoneTexts(trade, { ...zone, name: names.get(zone.slug) ?? zone.name }, locality)),
    indexable,
    canonicalPath: indexable ? listingPath(path, { page: query.page }) : null,
    // Each zone leads to its own trade and zone page, never to a query.
    zoneNav: zoneNav(tradePath, zones, names, zone?.slug ?? null, (slug) =>
      localityPath(locality, `${trade.slug}-${slug}`),
    ),
    businesses: rows.businesses.map((business) => withZoneName(business, names)),
    empty,
    nextPath: rows.hasNext ? listingPath(path, { page: query.page + 1 }) : null,
  };
}

/**
 * The listing page `segment` names in `locality`, or null when there is none:
 * a segment that is no category, trade or trade and zone pair, or a page past
 * the last. Page 1 always exists, and says so when it lists nothing.
 */
export async function listingPage(
  db: Db,
  locality: ServedLocality,
  segment: string,
  query: ListingQuery,
): Promise<ListingPage | null> {
  const read = await localitySegment(db, locality.code, segment);
  if (read === null) return null;
  if (read.kind === "category") return categoryPage(db, locality, read.category, query);
  return tradePage(db, locality, read.trade, read.zone, query);
}
