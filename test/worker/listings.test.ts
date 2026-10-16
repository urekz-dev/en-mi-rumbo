// The listing pages read from the database (src/core/business/listing-page.ts,
// src/core/business/listing.ts, src/core/catalogue/pages.ts) and their entries
// in the sitemap (src/core/seo/sitemap.ts), with the fixture localities of this
// file: docs/specs/public-directory.md, "Category listing at a clean URL with
// the catalogue slug", "Only what is published is shown", "Zone filter in the
// listing, without client-side JavaScript", "Indexable trade page at the root,
// generated from the closed catalogue", "Indexable trade and zone page",
// "Trade pages without published businesses are neither indexed nor linked,
// but are not 404 either", "An edit awaiting review does not show through on
// any public surface", "Own title and description on each directory page, with
// its canonical", "Public URLs carry the state and the municipality (v2)",
// "Directory lists show 20 cards per page, with "Ver más" to the next (v2)"
// and "A zone whose name repeats in its locality is shown with its settlement
// type (v2)"; docs/specs/base-layout.md, "The sitemap lists the pages that exist, from the
// database (v2)". The route is tested end to end (test/e2e/listings.spec.ts).
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  type ListingPage,
  type ListingQuery,
  listingPage,
} from "../../src/core/business/listing-page.ts";
import { localitySegment } from "../../src/core/catalogue/pages.ts";
import {
  businesses,
  businessTrades,
  categories,
  pendingEdits,
  trades,
  zones,
} from "../../src/core/db/schema/index.ts";
import { type ServedLocality, servedLocality } from "../../src/core/locality/served.ts";
import { sitemapEntries } from "../../src/core/seo/sitemap.ts";
import {
  businessValues,
  cleanup,
  createFixture,
  db,
  type Fixture,
  insertBusiness,
  type NewBusiness,
} from "./fixtures.ts";

const STATE = "86";
const HOME = `/estado-de-prueba-${STATE}/pueblo-uno`;
const CATEGORY = `categoria-prueba-${STATE}`;
const SECOND_CATEGORY = `categoria-prueba-${STATE}-dos`;
const MANY_CATEGORY = `categoria-prueba-${STATE}-muchos`;
const UNO = `giro-prueba-${STATE}-uno`;
const DOS = `giro-prueba-${STATE}-dos`;
const TRES = `giro-prueba-${STATE}-tres`;
const CUATRO = `giro-prueba-${STATE}-cuatro`;

let f: Fixture;
let locality: ServedLocality;
const zone = { centro: 0, norte: 0, haciendas: 0, vacia: 0 };
const category = { second: 0, many: 0 };
let cuatro = 0;
let futbol = 0;
/** The fixed businesses of the listings, by key. */
const ids: Record<string, string> = {};

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-15T18:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * DAY);

const assign = (businessId: string, ...tradeIds: number[]) =>
  db((tx) =>
    tx.insert(businessTrades).values(tradeIds.map((tradeId) => ({ businessId, tradeId }))),
  );

beforeAll(async () => {
  f = await createFixture(STATE);
  const [uno, dos] = f.tradeIds;
  zone.centro = f.zoneA;
  await db(async (tx) => {
    const added = await tx
      .insert(zones)
      .values([
        { localityCode: f.localityA, type: "Colonia", name: "Norte", slug: "norte" },
        {
          localityCode: f.localityA,
          type: "Fraccionamiento",
          name: "Haciendas de Pueblo Uno",
          slug: "haciendas-de-pueblo-uno",
        },
        { localityCode: f.localityA, type: "Colonia", name: "Vacía", slug: "vacia" },
      ])
      .returning({ id: zones.id });
    zone.norte = added[0]!.id;
    zone.haciendas = added[1]!.id;
    zone.vacia = added[2]!.id;
    const [second, many] = await tx
      .insert(categories)
      .values([
        { name: `Categoría de prueba ${STATE} dos`, slug: SECOND_CATEGORY },
        { name: `Categoría de prueba ${STATE} muchos`, slug: MANY_CATEGORY },
      ])
      .returning({ id: categories.id });
    category.second = second!.id;
    category.many = many!.id;
    const [fourth] = await tx
      .insert(trades)
      .values({ name: `Giro de prueba ${STATE} cuatro`, slug: CUATRO })
      .returning({ id: trades.id });
    cuatro = fourth!.id;
    const [real] = await tx.select({ id: trades.id }).from(trades).where(eq(trades.slug, "futbol"));
    futbol = real!.id;
  });
  locality = (await db((tx) => servedLocality(tx, `estado-de-prueba-${STATE}`, "pueblo-uno")))!;

  const publish = async (key: string, values: Partial<NewBusiness>, ...tradeIds: number[]) => {
    ids[key] = await insertBusiness(f, { status: "published", ...values });
    if (tradeIds.length > 0) await assign(ids[key], ...tradeIds);
  };
  await publish("newest", { name: "Abarrotes Uno de Prueba", publishedAt: daysAgo(1) }, uno);
  await publish(
    "delivery",
    {
      name: "Bodega Dos de Prueba",
      zoneId: zone.norte,
      homeDelivery: true,
      publishedAt: daysAgo(2),
    },
    uno,
    dos,
  );
  // A tie: the listing breaks it by name.
  await publish("tieZ", { name: "Zapatería Empate de Prueba", publishedAt: daysAgo(3) }, dos);
  await publish("tieF", {
    name: "Ferretería Empate de Prueba",
    zoneId: zone.norte,
    publishedAt: daysAgo(3),
  });
  await publish(
    "other",
    {
      name: "Colonia Otra de Prueba",
      zoneId: null,
      zoneOther: " Privada Inventada de Prueba ",
      publishedAt: daysAgo(4),
    },
    uno,
  );
  await publish(
    "secondCategory",
    {
      name: "Segunda Categoría de Prueba",
      categoryId: category.second,
      zoneId: zone.haciendas,
      publishedAt: daysAgo(5),
    },
    uno,
    futbol,
  );
  // Never listed: in review, rejected, unpublished, of the inactive locality.
  ids["inReview"] = await insertBusiness(f, {
    name: "En Revisión de Prueba",
    zoneId: zone.vacia,
  });
  ids["rejected"] = await insertBusiness(f, {
    name: "Rechazada de Prueba",
    zoneId: zone.vacia,
    status: "rejected",
    rejectedAt: daysAgo(1),
    rejectionReason: "Motivo de prueba",
  });
  ids["unpublished"] = await insertBusiness(f, {
    name: "Despublicada de Prueba",
    zoneId: zone.vacia,
    publishedAt: daysAgo(1),
    unpublishedAt: daysAgo(0),
    unpublishReason: "Motivo de prueba",
  });
  ids["elsewhere"] = await insertBusiness(f, {
    name: "Otra Localidad de Prueba",
    localityCode: f.localityB,
    zoneId: f.zoneB,
    status: "published",
    publishedAt: daysAgo(1),
  });
  for (const key of ["inReview", "rejected", "unpublished", "elsewhere"]) {
    await assign(ids[key]!, uno, f.tradeIds[2]);
  }
});

afterAll(async () => {
  await cleanup(STATE);
});

const read = (segment: string, query: Partial<ListingQuery> = {}) =>
  db((tx) => listingPage(tx, locality, segment, { page: 1, zone: null, ...query }));

const names = (page: ListingPage | null | undefined) => page?.businesses.map(({ name }) => name);

const UNLISTED = [
  "En Revisión de Prueba",
  "Rechazada de Prueba",
  "Despublicada de Prueba",
  "Otra Localidad de Prueba",
];

describe("Category listing at a clean URL with the catalogue slug", () => {
  // Scenario: listing of a category with businesses
  it("the listing of a category has its heading and one card per published business, newest first and ties by name", async () => {
    const page = await read(CATEGORY);

    expect(page).toMatchObject({
      kind: "category",
      heading: `Categoría de prueba ${STATE} en Pueblo Uno`,
      indexable: true,
      canonicalPath: `${HOME}/${CATEGORY}`,
      empty: null,
      nextPath: null,
    });
    expect(names(page)).toEqual([
      "Abarrotes Uno de Prueba",
      "Bodega Dos de Prueba",
      "Ferretería Empate de Prueba",
      "Zapatería Empate de Prueba",
      "Colonia Otra de Prueba",
    ]);
  });

  it("each card carries what the listing card shows, and nothing else", async () => {
    const page = await read(CATEGORY);

    expect(page?.businesses[1]).toEqual({
      id: ids["delivery"],
      name: "Bodega Dos de Prueba",
      categorySlug: CATEGORY,
      zoneName: "Norte",
      zoneSlug: "norte",
      homeDelivery: true,
      whatsapp: expect.stringMatching(/^771999\d{4}$/),
      photoKey: null,
    });
  });

  // Scenario: the category wins over the trade with the same slug
  it("the category wins over a trade with the same slug", async () => {
    const [clash] = await db((tx) =>
      tx
        .insert(trades)
        .values({ name: "Giro que se llama como la categoría", slug: CATEGORY })
        .returning({ id: trades.id }),
    );
    try {
      expect(await db((tx) => localitySegment(tx, locality.code, CATEGORY))).toMatchObject({
        kind: "category",
        category: { slug: CATEGORY },
      });
    } finally {
      await db((tx) => tx.delete(trades).where(eq(trades.id, clash!.id)));
    }
  });

  // Scenario: slug that is in no catalogue
  it.each([
    "plomeros-baratos",
    `${UNO}-colonia-inventada`,
    "loquesea-centro",
    "centro",
    "Plomeria",
    "plomería",
    "%2e%2e",
    "negocio",
    "a-".repeat(81),
  ])("%j is no page", async (segment) => {
    expect(await read(segment)).toBeNull();
  });

  it("a zone of another locality makes no trade and zone page", async () => {
    await db((tx) =>
      tx
        .insert(zones)
        .values({ localityCode: f.localityB, type: "Colonia", name: "Sur", slug: "sur" }),
    );
    expect(await read(`${UNO}-sur`)).toBeNull();
  });

  // Scenario: category with no published businesses yet
  it("a category with no published business yet says so, and is still indexed", async () => {
    const page = await read(MANY_CATEGORY);

    expect(page).toMatchObject({
      kind: "category",
      indexable: true,
      canonicalPath: `${HOME}/${MANY_CATEGORY}`,
      zoneNav: null,
      businesses: [],
      empty: { kind: "category" },
      nextPath: null,
    });
  });
});

describe("Only what is published is shown", () => {
  // Scenarios: a business under review does not appear in the listing; a
  // rejected business does not appear in the listing
  it("no listing, zone option or trade page shows a card in review, rejected, unpublished or of another locality", async () => {
    const pages = await Promise.all([
      read(CATEGORY),
      read(CATEGORY, { zone: "vacia" }),
      read(UNO),
      read(`${UNO}-vacia`),
      read(TRES),
    ]);
    for (const page of pages) {
      for (const name of UNLISTED) expect(names(page)).not.toContain(name);
    }
    // The zone of those cards is offered nowhere.
    expect(pages[0]?.zoneNav?.zones.map(({ name }) => name)).not.toContain("Vacía");
    expect(pages[2]?.zoneNav?.zones.map(({ name }) => name)).not.toContain("Vacía");
    // A trade whose only cards are unpublished is an empty trade page.
    expect(pages[4]).toMatchObject({ businesses: [], indexable: false });
  });
});

describe("An edit awaiting review does not show through on any public surface", () => {
  it("the listing shows the published card, with nothing of its pending edit", async () => {
    await db((tx) =>
      tx.insert(pendingEdits).values({
        businessId: ids["newest"]!,
        localityCode: f.localityA,
        name: "Abarrotes Propuestos y Asociados",
        categoryId: category.second,
        whatsapp: "7719990899",
        zoneId: zone.haciendas,
        homeDelivery: true,
      }),
    );

    const page = await read(CATEGORY);
    expect(page?.businesses[0]).toMatchObject({
      name: "Abarrotes Uno de Prueba",
      categorySlug: CATEGORY,
      zoneName: "Centro",
      homeDelivery: false,
    });
    expect(JSON.stringify(page)).not.toMatch(/Propuest|7719990899/);
    expect(names(await read(SECOND_CATEGORY))).toEqual(["Segunda Categoría de Prueba"]);
  });
});

describe("Zone filter in the listing, without client-side JavaScript", () => {
  // Scenario: only zones with businesses
  it("offers all the zones and each zone with a published card of the category, in catalogue order", async () => {
    const page = await read(CATEGORY);

    expect(page?.zoneNav).toEqual({
      all: { path: `${HOME}/${CATEGORY}`, current: true },
      zones: [
        { name: "Centro", path: `${HOME}/${CATEGORY}?colonia=centro`, current: false },
        { name: "Norte", path: `${HOME}/${CATEGORY}?colonia=norte`, current: false },
      ],
    });
  });

  // Scenario: filtering by a zone
  it("filtering by a zone lists only its cards, marks it, and names the listing without the filter as canonical", async () => {
    const page = await read(CATEGORY, { zone: "norte" });

    expect(names(page)).toEqual(["Bodega Dos de Prueba", "Ferretería Empate de Prueba"]);
    expect(page?.zoneNav?.all.current).toBe(false);
    expect(page?.zoneNav?.zones.filter(({ current }) => current).map(({ name }) => name)).toEqual([
      "Norte",
    ]);
    // Scenario: the filtered listing does not compete with the trade pages
    expect(page?.canonicalPath).toBe(`${HOME}/${CATEGORY}`);
    // The texts are the listing's.
    expect(page?.heading).toBe(`Categoría de prueba ${STATE} en Pueblo Uno`);
  });

  // Scenario: removing the filter
  it('"Todas las colonias" is the listing without the filter', async () => {
    const page = await read(CATEGORY, { zone: "norte" });

    expect(page?.zoneNav?.all.path).toBe(`${HOME}/${CATEGORY}`);
  });

  // Scenario: filter with businesses of that category but not in that zone
  it("a zone without cards of the category says so and leads back to all the zones", async () => {
    const page = await read(CATEGORY, { zone: "haciendas-de-pueblo-uno" });

    expect(page).toMatchObject({
      businesses: [],
      empty: { kind: "category-zone", allZonesPath: `${HOME}/${CATEGORY}` },
      indexable: true,
      canonicalPath: `${HOME}/${CATEGORY}`,
    });
  });

  // Scenario: unknown zone in the URL
  it.each(["colonia-inventada", "", "Norte", "sur"])(
    "an unknown zone (%j) is ignored: the whole listing, without error",
    async (unknown) => {
      const page = await read(CATEGORY, { zone: unknown });

      expect(names(page)).toHaveLength(5);
      expect(page?.zoneNav?.all.current).toBe(true);
      expect(page?.canonicalPath).toBe(`${HOME}/${CATEGORY}`);
    },
  );

  // Scenario: published business with unnormalized "Otra" zone
  it('a card of the zone "Otra" shows its text, only in the unfiltered listing, and brings no option', async () => {
    const all = await read(CATEGORY);
    const other = all?.businesses.find(({ id }) => id === ids["other"]);

    expect(other).toMatchObject({ zoneName: "Privada Inventada de Prueba", zoneSlug: null });
    for (const slug of ["centro", "norte"]) {
      expect(names(await read(CATEGORY, { zone: slug }))).not.toContain("Colonia Otra de Prueba");
    }
    expect(all?.zoneNav?.zones).toHaveLength(2);
  });
});

describe("Indexable trade page at the root, generated from the closed catalogue", () => {
  // Scenarios: page of a trade with businesses; the trade rules, not the
  // category; a business without that trade does not appear
  it("lists every published card with the trade, whatever its category, in the listings' order", async () => {
    const page = await read(UNO);

    expect(page).toMatchObject({
      kind: "trade",
      heading: `Giro de prueba ${STATE} uno en Pueblo Uno`,
      indexable: true,
      canonicalPath: `${HOME}/${UNO}`,
      empty: null,
    });
    expect(names(page)).toEqual([
      "Abarrotes Uno de Prueba",
      "Bodega Dos de Prueba",
      "Colonia Otra de Prueba",
      "Segunda Categoría de Prueba",
    ]);
    expect(names(await read(DOS))).toEqual(["Bodega Dos de Prueba", "Zapatería Empate de Prueba"]);
  });

  // Scenario: the sports trade lands the search that PRD §6.5 asks for
  it("the heading is the trade's curated phrase", async () => {
    const page = await read("futbol");

    expect(page?.heading).toBe("Clases de futbol en Pueblo Uno");
    expect(names(page)).toEqual(["Segunda Categoría de Prueba"]);
  });

  // Scenario: the zone navigation leads to own URLs
  it("the zone navigation leads to the trade and zone pages, only for zones with cards of the trade", async () => {
    const page = await read(UNO);

    expect(page?.zoneNav).toEqual({
      all: { path: `${HOME}/${UNO}`, current: true },
      zones: [
        { name: "Centro", path: `${HOME}/${UNO}-centro`, current: false },
        { name: "Norte", path: `${HOME}/${UNO}-norte`, current: false },
        {
          name: "Haciendas de Pueblo Uno",
          path: `${HOME}/${UNO}-haciendas-de-pueblo-uno`,
          current: false,
        },
      ],
    });
  });
});

describe("Indexable trade and zone page", () => {
  // Scenarios: trade and zone page with businesses; the filter is real
  it("lists only the cards with the trade in the zone of the URL", async () => {
    const page = await read(`${UNO}-norte`);

    expect(page).toMatchObject({
      kind: "trade+zone",
      heading: `Giro de prueba ${STATE} uno en Norte, Pueblo Uno`,
      indexable: true,
      canonicalPath: `${HOME}/${UNO}-norte`,
    });
    expect(names(page)).toEqual(["Bodega Dos de Prueba"]);
  });

  // Scenario: the zone that already says the locality does not repeat it
  it("a zone whose name says the locality's is not followed by it", async () => {
    const page = await read(`${UNO}-haciendas-de-pueblo-uno`);

    expect(page?.heading).toBe(`Giro de prueba ${STATE} uno en Haciendas de Pueblo Uno`);
    expect(page?.description).toBe(
      `Giro de prueba ${STATE} uno en Haciendas de Pueblo Uno: negocios verificados de Pueblo Uno que contactas directo por WhatsApp.`,
    );
  });

  // Scenario: going back to the whole trade
  it('marks its zone, and "Todas las colonias" leads back to the trade page', async () => {
    const page = await read(`${UNO}-norte`);

    expect(page?.zoneNav?.all).toEqual({ path: `${HOME}/${UNO}`, current: false });
    expect(page?.zoneNav?.zones.filter(({ current }) => current).map(({ path }) => path)).toEqual([
      `${HOME}/${UNO}-norte`,
    ]);
  });

  it("a zone filter in the query means nothing on a trade page", async () => {
    expect(await read(UNO, { zone: "norte" })).toEqual(await read(UNO));
  });
});

describe("Trade pages without published businesses are neither indexed nor linked, but are not 404 either", () => {
  // Scenario: catalogue trade that does not have businesses yet
  it("a trade without published cards is a page, not indexed, without a canonical, that says so", async () => {
    const page = await read(TRES);

    expect(page).toMatchObject({
      kind: "trade",
      heading: `Giro de prueba ${STATE} tres en Pueblo Uno`,
      indexable: false,
      canonicalPath: null,
      zoneNav: null,
      businesses: [],
      empty: { kind: "trade" },
      nextPath: null,
    });
  });

  // Scenario: trade and zone combination without businesses
  it("a trade and zone without cards leads to the whole trade page when it has cards", async () => {
    const page = await read(`${DOS}-haciendas-de-pueblo-uno`);

    expect(page).toMatchObject({
      kind: "trade+zone",
      indexable: false,
      canonicalPath: null,
      businesses: [],
      empty: { kind: "trade-zone", allZonesPath: `${HOME}/${DOS}` },
    });
  });

  // Scenario: the empty is not linked either
  it("a trade and zone without cards, of a trade without cards, links to no empty page", async () => {
    const page = await read(`${TRES}-centro`);

    expect(page).toMatchObject({
      indexable: false,
      zoneNav: null,
      empty: { kind: "trade-zone", allZonesPath: null },
    });
  });

  it('a trade whose only cards are of the zone "Otra" is no empty page to link to', async () => {
    const id = await insertBusiness(f, {
      name: "Solo Otra de Prueba",
      zoneId: null,
      zoneOther: "Privada de Prueba",
      status: "published",
      publishedAt: daysAgo(9),
    });
    await assign(id, cuatro);

    const page = await read(`${CUATRO}-centro`);
    expect(page?.empty).toEqual({ kind: "trade-zone", allZonesPath: `${HOME}/${CUATRO}` });
    expect((await read(CUATRO))?.indexable).toBe(true);
    await db((tx) => tx.delete(businesses).where(eq(businesses.id, id)));
  });

  // Scenario: what does have content is indexed
  it("a trade page and a trade and zone page with cards are indexed", async () => {
    for (const segment of [UNO, `${UNO}-centro`]) {
      expect((await read(segment))?.indexable, segment).toBe(true);
    }
  });
});

describe("A zone whose name repeats in its locality is shown with its settlement type (v2)", () => {
  const TOCAYAS = `categoria-prueba-${STATE}-tocayas`;
  const CINCO = `giro-prueba-${STATE}-cinco`;
  const added: string[] = [];

  beforeAll(async () => {
    // Two zones named "Lomas" and one named like the locality, with a card
    // each in a category and a trade of their own.
    const { categoryId, tradeId, zoneIds } = await db(async (tx) => {
      const rows = await tx
        .insert(zones)
        .values([
          { localityCode: f.localityA, type: "Colonia", name: "Lomas", slug: "colonia-lomas" },
          {
            localityCode: f.localityA,
            type: "Fraccionamiento",
            name: "Lomas",
            slug: "fraccionamiento-lomas",
          },
          {
            localityCode: f.localityA,
            type: "Unidad habitacional",
            name: "Pueblo Uno",
            slug: "unidad-habitacional-pueblo-uno",
          },
        ])
        .returning({ id: zones.id });
      const [newCategory] = await tx
        .insert(categories)
        .values({ name: `Categoría de prueba ${STATE} tocayas`, slug: TOCAYAS })
        .returning({ id: categories.id });
      const [newTrade] = await tx
        .insert(trades)
        .values({ name: `Giro de prueba ${STATE} cinco`, slug: CINCO })
        .returning({ id: trades.id });
      return {
        categoryId: newCategory!.id,
        tradeId: newTrade!.id,
        zoneIds: rows.map(({ id }) => id),
      };
    });
    for (const [index, zoneId] of zoneIds.entries()) {
      const id = await insertBusiness(f, {
        name: `Tocaya ${index + 1} de Prueba`,
        categoryId,
        zoneId,
        status: "published",
        publishedAt: daysAgo(20 + index),
      });
      await assign(id, tradeId);
      added.push(id);
    }
  });

  afterAll(async () => {
    await db((tx) => tx.delete(businesses).where(inArray(businesses.id, added)));
  });

  // Scenarios: two zones with the same name; a zone named like its municipality
  it("the cards and the zone filter show the type of a zone whose name repeats", async () => {
    const page = await read(TOCAYAS);

    expect(page?.businesses.map(({ zoneName, zoneSlug }) => [zoneName, zoneSlug])).toEqual([
      ["Lomas (Colonia)", "colonia-lomas"],
      ["Lomas (Fraccionamiento)", "fraccionamiento-lomas"],
      ["Pueblo Uno (Unidad habitacional)", "unidad-habitacional-pueblo-uno"],
    ]);
    expect(page?.zoneNav?.zones.map(({ name, path }) => [name, path])).toEqual([
      ["Lomas (Colonia)", `${HOME}/${TOCAYAS}?colonia=colonia-lomas`],
      ["Lomas (Fraccionamiento)", `${HOME}/${TOCAYAS}?colonia=fraccionamiento-lomas`],
      [
        "Pueblo Uno (Unidad habitacional)",
        `${HOME}/${TOCAYAS}?colonia=unidad-habitacional-pueblo-uno`,
      ],
    ]);
  });

  it("the trade's zone navigation and the trade and zone texts show it too, and the slugs do not change", async () => {
    const trade = await read(CINCO);
    const lomas = await read(`${CINCO}-fraccionamiento-lomas`);
    const own = await read(`${CINCO}-unidad-habitacional-pueblo-uno`);

    expect(trade?.zoneNav?.zones.map(({ name }) => name)).toEqual([
      "Lomas (Colonia)",
      "Lomas (Fraccionamiento)",
      "Pueblo Uno (Unidad habitacional)",
    ]);
    expect(lomas).toMatchObject({
      heading: `Giro de prueba ${STATE} cinco en Lomas (Fraccionamiento), Pueblo Uno`,
      description: `Giro de prueba ${STATE} cinco en Lomas (Fraccionamiento): negocios verificados de Pueblo Uno que contactas directo por WhatsApp.`,
      canonicalPath: `${HOME}/${CINCO}-fraccionamiento-lomas`,
    });
    // The zone already names the locality, so the heading does not repeat it.
    expect(own?.heading).toBe(`Giro de prueba ${STATE} cinco en Pueblo Uno (Unidad habitacional)`);
  });

  it("a zone whose name repeats nowhere keeps its name alone", async () => {
    const page = await read(`${UNO}-norte`);

    expect(page?.heading).toBe(`Giro de prueba ${STATE} uno en Norte, Pueblo Uno`);
    expect(page?.businesses[0]?.zoneName).toBe("Norte");
  });
});

describe('Directory lists show 20 cards per page, with "Ver más" to the next (v2)', () => {
  const MANY = 45;
  /** The 45 cards, in the order the listing must show them. */
  let expected: string[] = [];

  beforeAll(async () => {
    // Five publication dates, so ties are broken by name across the pages:
    // 20 in Norte and 25 in Centro, and the first 25 with the fourth trade.
    const values = Array.from({ length: MANY }, (_, index) =>
      businessValues(f, {
        name: `Negocio de Paginación ${String(index + 1).padStart(2, "0")}`,
        categoryId: category.many,
        zoneId: index % 9 < 4 ? zone.norte : zone.centro,
        status: "published",
        publishedAt: daysAgo(10 + (index % 5)),
      }),
    );
    await db((tx) => tx.insert(businesses).values(values));
    await db((tx) =>
      tx
        .insert(businessTrades)
        .values(values.slice(0, 25).map(({ id }) => ({ businessId: id, tradeId: cuatro }))),
    );
    expected = values
      .toSorted(
        (a, b) =>
          b.publishedAt!.getTime() - a.publishedAt!.getTime() ||
          (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      )
      .map(({ name }) => name);
  });

  afterAll(async () => {
    await db((tx) => tx.delete(businesses).where(eq(businesses.categoryId, category.many)));
  });

  // Scenario: a listing longer than a page
  it("shows 20 cards a page and links each page to the next, until the last", async () => {
    const path = `${HOME}/${MANY_CATEGORY}`;
    const [one, two, three] = await Promise.all(
      [1, 2, 3].map((page) => read(MANY_CATEGORY, { page })),
    );

    expect(names(one)).toEqual(expected.slice(0, 20));
    expect(names(two)).toEqual(expected.slice(20, 40));
    expect(names(three)).toEqual(expected.slice(40));
    expect([one?.nextPath, two?.nextPath, three?.nextPath]).toEqual([
      `${path}?pagina=2`,
      `${path}?pagina=3`,
      null,
    ]);
  });

  // Scenario: each page names itself
  it("each page after the first is its own canonical, with its number", async () => {
    const path = `${HOME}/${MANY_CATEGORY}`;

    expect((await read(MANY_CATEGORY))?.canonicalPath).toBe(path);
    expect((await read(MANY_CATEGORY, { page: 2 }))?.canonicalPath).toBe(`${path}?pagina=2`);
  });

  // Scenario: past the last page
  it("a page past the last is no page, while an empty first page still is", async () => {
    expect(await read(MANY_CATEGORY, { page: 4 })).toBeNull();
    expect(await read(MANY_CATEGORY, { page: 9_000_000_000 })).toBeNull();
    expect(await read(SECOND_CATEGORY, { page: 2 })).toBeNull();
    expect(await read(TRES, { page: 2 })).toBeNull();
    expect(await read(TRES)).not.toBeNull();
  });

  it("exactly 20 cards make one page", async () => {
    const page = await read(MANY_CATEGORY, { zone: "norte" });

    expect(page?.businesses).toHaveLength(20);
    expect(page?.nextPath).toBeNull();
  });

  // Scenario: the zone filter is kept
  it("the next page of a filtered listing keeps the filter, and names the listing without it", async () => {
    const path = `${HOME}/${MANY_CATEGORY}`;
    const one = await read(MANY_CATEGORY, { zone: "centro" });
    const two = await read(MANY_CATEGORY, { zone: "centro", page: 2 });

    expect(one?.nextPath).toBe(`${path}?colonia=centro&pagina=2`);
    expect(two?.businesses).toHaveLength(5);
    expect(two?.nextPath).toBeNull();
    expect(two?.canonicalPath).toBe(path);
    expect(two?.zoneNav?.zones.find(({ current }) => current)?.path).toBe(`${path}?colonia=centro`);
    expect(await read(MANY_CATEGORY, { zone: "centro", page: 3 })).toBeNull();
  });

  it("the trade pages paginate the same way", async () => {
    const one = await read(CUATRO);
    const two = await read(CUATRO, { page: 2 });

    expect(one?.businesses).toHaveLength(20);
    expect(one?.nextPath).toBe(`${HOME}/${CUATRO}?pagina=2`);
    expect(two?.businesses).toHaveLength(5);
    expect(two?.canonicalPath).toBe(`${HOME}/${CUATRO}?pagina=2`);
    expect(two?.nextPath).toBeNull();
    expect(new Set([...names(one)!, ...names(two)!]).size).toBe(25);
  });
});

describe("The sitemap lists the pages that exist, from the database (v2)", () => {
  /** This file's paths of the active locality, without the cards and the home. */
  const listed = async () =>
    (await db(sitemapEntries))
      .map(({ path }) => path)
      .filter((path) => path.startsWith(`${HOME}/`) && !path.startsWith(`${HOME}/negocio/`));

  it("lists every category's listing, even an empty one, once", async () => {
    const paths = await listed();

    for (const slug of [CATEGORY, SECOND_CATEGORY, MANY_CATEGORY, "servicios-del-hogar", "otro"]) {
      expect(
        paths.filter((path) => path === `${HOME}/${slug}`),
        slug,
      ).toHaveLength(1);
    }
  });

  // Scenarios: the empty is not indexed; what does have content is indexed
  it("lists the trade pages and trade and zone pages with published cards, and no other", async () => {
    const paths = await listed();
    const tradePages = paths.filter((path) => /\/(giro-prueba-86-|futbol)/.test(path));

    expect(tradePages.toSorted()).toEqual(
      [
        `${HOME}/futbol`,
        `${HOME}/futbol-haciendas-de-pueblo-uno`,
        `${HOME}/${DOS}`,
        `${HOME}/${DOS}-centro`,
        `${HOME}/${DOS}-norte`,
        `${HOME}/${UNO}`,
        `${HOME}/${UNO}-centro`,
        `${HOME}/${UNO}-haciendas-de-pueblo-uno`,
        `${HOME}/${UNO}-norte`,
      ].toSorted(),
    );
  });

  it("lists nothing of the inactive locality, and no page after the first", async () => {
    const all = (await db(sitemapEntries)).map(({ path }) => path);

    expect(all.filter((path) => path.startsWith(`/estado-de-prueba-${STATE}/pueblo-dos`))).toEqual(
      [],
    );
    expect(all.filter((path) => path.includes("?"))).toEqual([]);
  });
});
