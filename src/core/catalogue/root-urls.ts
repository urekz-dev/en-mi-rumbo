// The one-segment URLs of a locality (docs/specs/data-model.md, "The slugs of
// the catalogues do not produce ambiguous URLs at the root of a locality
// (v2)"; docs/specs/public-directory.md, "Category listing at a clean URL with
// the catalogue slug", "Indexable trade and zone page" and "Public URLs carry
// the state and the municipality (v2)"). Under `/{estado}/{municipio}/`, one
// path segment is a category (`servicios-del-hogar`), a trade (`plomeria`) or a
// trade and a zone of that locality joined by a hyphen
// (`plomeria-haciendas-de-tizayuca`), beside the site's own pages. Every such
// segment must read in only one way. Everything here is pure: no database.

/**
 * Path segments that belong to the site's own pages, so no category, trade,
 * zone or trade and zone pair may take them. Reserving a name is free; moving
 * a published URL is not. A route whose name has a dot (`robots.txt`,
 * `sitemap.xml`) can never be a slug, so it needs no entry.
 */
export const RESERVED_SEGMENTS: readonly string[] = [
  // The pages of a locality, under `/{estado}/{municipio}/` (public-directory,
  // "Public URLs carry the state and the municipality (v2)").
  "buscar", // search results, /buscar?q=…
  "negocio", // cards, /negocio/<slug>-<id>, and their report form
  "reportar", // the report thank-you page, /reportar/gracias
  "registro", // registration and /registro/gracias
  "editar", // edit mode of the management link, /editar/<token>
  // The legal pages, which legal-pages calls reserved segments.
  "aviso-de-privacidad",
  "terminos",
  // Routes of the site root (ADR 0010, deployment).
  "admin",
  "health",
];

const RESERVED = new Set(RESERVED_SEGMENTS);

/** Whether `segment` is one of the site's own routes. */
export function isReservedSegment(segment: string): boolean {
  return RESERVED.has(segment);
}

export interface CatalogueEntry {
  name: string;
  slug: string;
}

/** The catalogues that share the URLs of one locality. */
export interface LocalityCatalogues {
  /** Global. */
  categories: readonly CatalogueEntry[];
  /** Global. */
  trades: readonly CatalogueEntry[];
  /** The zones of the locality, hidden ones included: a slug never changes. */
  zones: readonly CatalogueEntry[];
}

/** One way to read a path segment of a locality. */
export type RootReading =
  | { kind: "reserved" }
  | { kind: "category" | "trade" | "zone"; entry: CatalogueEntry }
  | { kind: "trade+zone"; trade: CatalogueEntry; zone: CatalogueEntry };

export interface RootUrlConflict {
  /** The path segment under `/{estado}/{municipio}/`. */
  segment: string;
  /** Every way the segment can be read: two or more. */
  readings: RootReading[];
  /** The segment and its readings, for whoever has to fix the catalogue. */
  message: string;
}

const entry = (kind: string, { name, slug }: CatalogueEntry) => `${kind} ${slug} ("${name}")`;

function describe(reading: RootReading): string {
  switch (reading.kind) {
    case "reserved":
      return "a route of the site";
    case "trade+zone":
      return `${entry("trade", reading.trade)} + ${entry("zone", reading.zone)}`;
    default:
      return entry(reading.kind, reading.entry);
  }
}

/**
 * The path segments of one locality that read in more than one way, sorted;
 * none when its URLs are unambiguous. A segment conflicts when it is a
 * reserved segment and also a slug or a trade and zone pair, when a category
 * shares it with anything else, or when it is two of: a trade, a trade and
 * zone pair, another such pair. A zone on its own is no page, so it conflicts
 * only with a category or a reserved segment.
 */
export function rootUrlConflicts(catalogues: LocalityCatalogues): RootUrlConflict[] {
  const bySegment = new Map<string, RootReading[]>();
  const add = (segment: string, reading: RootReading) => {
    const readings = bySegment.get(segment);
    if (readings) readings.push(reading);
    else bySegment.set(segment, [reading]);
  };

  for (const segment of RESERVED_SEGMENTS) add(segment, { kind: "reserved" });
  for (const category of catalogues.categories)
    add(category.slug, { kind: "category", entry: category });
  for (const trade of catalogues.trades) add(trade.slug, { kind: "trade", entry: trade });
  for (const zone of catalogues.zones) add(zone.slug, { kind: "zone", entry: zone });
  for (const trade of catalogues.trades) {
    for (const zone of catalogues.zones) {
      add(`${trade.slug}-${zone.slug}`, { kind: "trade+zone", trade, zone });
    }
  }

  const conflicts: RootUrlConflict[] = [];
  for (const [segment, all] of bySegment) {
    const decisive = all.some(({ kind }) => kind === "category" || kind === "reserved");
    const readings = decisive ? all : all.filter(({ kind }) => kind !== "zone");
    if (readings.length > 1) {
      conflicts.push({
        segment,
        readings,
        message: `"${segment}" reads as ${readings.map(describe).join(" and as ")}`,
      });
    }
  }
  return conflicts.toSorted((a, b) => (a.segment < b.segment ? -1 : 1));
}
