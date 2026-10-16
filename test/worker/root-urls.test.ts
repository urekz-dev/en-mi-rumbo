// docs/specs/data-model.md, "The slugs of the catalogues do not produce
// ambiguous URLs at the root of a locality (v2)": the check
// (src/core/catalogue/root-urls.ts) on the catalogues the migrations leave, for
// every locality that has zones, and on small catalogues for each way a URL
// can read twice. And docs/specs/public-directory.md, "Category listing at a
// clean URL with the catalogue slug" and "Indexable trade and zone page": how
// a segment is read (`readSegment`), on the same catalogues.
import { asc, lt } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { MAX_SEGMENT_LENGTH } from "../../src/core/catalogue/pages.ts";
import {
  type CatalogueEntry,
  isReservedSegment,
  type LocalityCatalogues,
  readSegment,
  RESERVED_SEGMENTS,
  rootUrlConflicts,
  segmentSplits,
} from "../../src/core/catalogue/root-urls.ts";
import { categories, trades, zones } from "../../src/core/db/schema/index.ts";
import { db, FIRST_FIXTURE_CODE, isFixtureSlug } from "./fixtures.ts";

/** The real catalogues of each locality with zones, by locality code. */
let byLocality: Map<string, LocalityCatalogues>;
let tizayuca: LocalityCatalogues;

beforeAll(async () => {
  // Other test files add fixture categories, trades and zones while this runs.
  const real = (rows: CatalogueEntry[]) => rows.filter(({ slug }) => !isFixtureSlug(slug));
  const [categoryRows, tradeRows, zoneRows] = await db((tx) =>
    Promise.all([
      tx.select({ name: categories.name, slug: categories.slug }).from(categories),
      tx.select({ name: trades.name, slug: trades.slug }).from(trades),
      tx
        .select({ locality: zones.localityCode, name: zones.name, slug: zones.slug })
        .from(zones)
        .where(lt(zones.localityCode, FIRST_FIXTURE_CODE))
        .orderBy(asc(zones.localityCode), asc(zones.slug)),
    ]),
  );
  byLocality = new Map(
    [...Map.groupBy(zoneRows, ({ locality }) => locality)].map(([locality, list]) => [
      locality,
      {
        categories: real(categoryRows),
        trades: real(tradeRows),
        zones: list.map(({ name, slug }) => ({ name, slug })),
      },
    ]),
  );
  tizayuca = byLocality.get("13069")!;
});

const entry = (name: string, slug: string): CatalogueEntry => ({ name, slug });

/** Today's catalogues of Tizayuca, with one more entry. */
const plus = (catalogue: keyof LocalityCatalogues, added: CatalogueEntry): LocalityCatalogues => ({
  ...tizayuca,
  [catalogue]: [...tizayuca[catalogue], added],
});

describe("The slugs of the catalogues do not produce ambiguous URLs at the root of a locality (v2)", () => {
  it("today's catalogues are unambiguous in every locality with zones", () => {
    expect([...byLocality.keys()]).toContain("13069");
    expect(tizayuca.categories).toHaveLength(8);
    expect(tizayuca.trades).toHaveLength(49);
    expect(tizayuca.zones).toHaveLength(105);
    for (const [locality, catalogues] of byLocality) {
      expect({ locality, conflicts: rootUrlConflicts(catalogues) }).toEqual({
        locality,
        conflicts: [],
      });
    }
  });

  it("a trade or a zone named like a category: a trade", () => {
    const conflicts = rootUrlConflicts(plus("trades", entry("Talleres", "talleres")));
    expect(conflicts).toEqual([
      {
        segment: "talleres",
        readings: [
          { kind: "category", entry: entry("Talleres", "talleres") },
          { kind: "trade", entry: entry("Talleres", "talleres") },
        ],
        message:
          '"talleres" reads as category talleres ("Talleres") and as trade talleres ("Talleres")',
      },
    ]);
  });

  it("a trade or a zone named like a category: a zone", () => {
    const conflicts = rootUrlConflicts(plus("zones", entry("Salud", "salud")));
    expect(conflicts.map(({ segment }) => segment)).toEqual(["salud"]);
    expect(conflicts[0]?.readings.map(({ kind }) => kind)).toEqual(["category", "zone"]);
  });

  it.each([
    ["trades", "buscar"],
    ["zones", "registro"],
    ["categories", "negocio"],
  ] as const)("a slug of %s that would shadow an own route (%s)", (catalogue, slug) => {
    const conflicts = rootUrlConflicts(plus(catalogue, entry("Inventado", slug)));
    expect(conflicts.map(({ segment }) => segment)).toContain(slug);
    const conflict = conflicts.find(({ segment }) => segment === slug);
    expect(conflict?.readings[0]).toEqual({ kind: "reserved" });
    expect(conflict?.message).toContain(`"${slug}" reads as a route of the site`);
  });

  it("a composed slug with two readings: the check names both", () => {
    const conflicts = rootUrlConflicts({
      categories: [],
      trades: [entry("Uno", "a"), entry("Uno dos", "a-b")],
      zones: [entry("Dos tres", "b-c"), entry("Tres", "c")],
    });
    expect(conflicts).toEqual([
      {
        segment: "a-b-c",
        readings: [
          { kind: "trade+zone", trade: entry("Uno", "a"), zone: entry("Dos tres", "b-c") },
          { kind: "trade+zone", trade: entry("Uno dos", "a-b"), zone: entry("Tres", "c") },
        ],
        message:
          '"a-b-c" reads as trade a ("Uno") + zone b-c ("Dos tres") ' +
          'and as trade a-b ("Uno dos") + zone c ("Tres")',
      },
    ]);
  });

  it("a composed slug that is already taken: a category or a trade", () => {
    const conflicts = rootUrlConflicts({
      categories: [entry("Talleres de motos", "talleres-motos")],
      trades: [
        entry("Talleres", "talleres"),
        entry("Pintura", "pintura"),
        entry("Pintura fina", "pintura-fina"),
      ],
      zones: [entry("Motos", "motos"), entry("Fina", "fina")],
    });
    expect(
      conflicts.map(({ segment, readings }) => [segment, readings.map(({ kind }) => kind)]),
    ).toEqual([
      ["pintura-fina", ["trade", "trade+zone"]],
      ["talleres-motos", ["category", "trade+zone"]],
    ]);
  });

  it("a composed slug that is already taken: an own route", () => {
    const conflicts = rootUrlConflicts({
      categories: [],
      trades: [entry("Aviso", "aviso")],
      zones: [entry("De privacidad", "de-privacidad")],
    });
    expect(conflicts.map(({ segment }) => segment)).toEqual(["aviso-de-privacidad"]);
  });

  it("a zone named like a trade: a zone alone is no page", () => {
    expect(rootUrlConflicts(plus("zones", entry("Pintura", "pintura")))).toEqual([]);
  });

  it("the site's own routes are reserved", () => {
    for (const segment of ["buscar", "negocio", "reportar", "registro", "editar"]) {
      expect(isReservedSegment(segment)).toBe(true);
    }
    expect(isReservedSegment("aviso-de-privacidad")).toBe(true);
    expect(isReservedSegment("terminos")).toBe(true);
    expect(isReservedSegment("plomeria")).toBe(false);
    expect(new Set(RESERVED_SEGMENTS).size).toBe(RESERVED_SEGMENTS.length);
  });
});

describe("Category listing at a clean URL with the catalogue slug: the segment's reading", () => {
  const category = (slug: string) => tizayuca.categories.find((entry) => entry.slug === slug)!;
  const trade = (slug: string) => tizayuca.trades.find((entry) => entry.slug === slug)!;
  const zone = (slug: string) => tizayuca.zones.find((entry) => entry.slug === slug)!;

  it("a category slug is its listing", () => {
    expect(readSegment("servicios-del-hogar", tizayuca)).toEqual({
      kind: "category",
      category: category("servicios-del-hogar"),
    });
  });

  it("a trade slug is its page", () => {
    expect(readSegment("plomeria", tizayuca)).toEqual({
      kind: "trade",
      trade: trade("plomeria"),
      zone: null,
    });
  });

  it("a trade and a zone of the locality are their page, with hyphens in both", () => {
    expect(readSegment("plomeria-haciendas-de-tizayuca", tizayuca)).toEqual({
      kind: "trade+zone",
      trade: trade("plomeria"),
      zone: zone("haciendas-de-tizayuca"),
    });
    expect(readSegment("taekwondo-artes-marciales-huicalco", tizayuca)).toMatchObject({
      kind: "trade+zone",
      trade: { slug: "taekwondo-artes-marciales" },
      zone: { slug: "huicalco" },
    });
  });

  // Scenario: the category wins over the trade with the same slug
  it("the category wins over a trade, and the trade over a trade and zone pair", () => {
    // Catalogues the check would refuse, to see the order of the readings.
    const catalogues = {
      categories: [entry("Talleres", "talleres")],
      trades: [
        entry("Talleres", "talleres"),
        entry("Pintura", "pintura"),
        entry("Pintura fina", "pintura-fina"),
      ],
      zones: [entry("Fina", "fina"), entry("Talleres", "talleres")],
    };
    expect(readSegment("talleres", catalogues)).toEqual({
      kind: "category",
      category: entry("Talleres", "talleres"),
    });
    expect(readSegment("pintura-fina", catalogues)).toEqual({
      kind: "trade",
      trade: entry("Pintura fina", "pintura-fina"),
      zone: null,
    });
  });

  // Scenarios: slug that is in no catalogue; compound that does not exist
  it.each([
    "plomeros-baratos",
    "plomeria-colonia-inventada",
    "loquesea-huicalco",
    "huicalco",
    "plomeria-",
    "-plomeria",
    "",
  ])("%j is no page", (segment) => {
    expect(readSegment(segment, tizayuca)).toBeNull();
  });

  // Scenario: the dynamic route does not shadow the site's own routes
  it("a reserved segment is no page, whatever the catalogues hold", () => {
    for (const segment of RESERVED_SEGMENTS) {
      expect(readSegment(segment, plus("categories", entry("Inventada", segment)))).toBeNull();
    }
  });

  it("a segment that reads as two trade and zone pairs is no page", () => {
    expect(
      readSegment("a-b-c", {
        categories: [],
        trades: [entry("Uno", "a"), entry("Uno dos", "a-b")],
        zones: [entry("Dos tres", "b-c"), entry("Tres", "c")],
      }),
    ).toBeNull();
  });

  it("a segment is cut at each hyphen", () => {
    expect(segmentSplits("a-b-c")).toEqual([
      { trade: "a", zone: "b-c" },
      { trade: "a-b", zone: "c" },
    ]);
    expect(segmentSplits("plomeria")).toEqual([]);
    expect(segmentSplits("a--b")).toEqual([
      { trade: "a", zone: "-b" },
      { trade: "a-", zone: "b" },
    ]);
  });

  it("every page of the catalogues fits the longest segment that is read", () => {
    for (const [locality, catalogues] of byLocality) {
      const longest = Math.max(
        ...catalogues.categories.map(({ slug }) => slug.length),
        ...catalogues.trades.flatMap((t) =>
          catalogues.zones.map((z) => t.slug.length + 1 + z.slug.length),
        ),
      );
      expect({ locality, fits: longest <= MAX_SEGMENT_LENGTH }).toEqual({ locality, fits: true });
    }
  });
});
