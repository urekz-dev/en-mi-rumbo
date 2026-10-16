// The search against the database (src/core/search): the normalized columns
// the database generates, and the query of docs/specs/public-directory.md. Fixture
// state 95. The pure half (normalization and terms) is in
// search-normalize.test.ts; the results page is rendered in
// test/astro/search-page.test.ts and served in test/e2e/search.spec.ts, and
// its quota is tested in quota.test.ts.
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  businesses,
  businessTrades,
  municipalities,
  pendingEdits,
  trades,
} from "../../src/core/db/schema/index.ts";
import { PAGE_SIZE, pageSlice } from "../../src/core/pagination.ts";
import { normalizeText } from "../../src/core/search/normalize.ts";
import {
  normalizedSql,
  type SearchLocality,
  type SearchResult,
  searchPublishedBusinesses,
} from "../../src/core/search/query.ts";
import {
  cleanup,
  createFixture,
  db,
  fakePhone,
  type Fixture,
  insertBusiness,
  type NewBusiness,
  pgErrorCode,
  query,
} from "./fixtures.ts";

const STATE = "95";
let f: Fixture;
let localityA: SearchLocality;
let localityB: SearchLocality;
let fondaTrade: number;

/** A locality as the page resolves it: its code and the name of its record. */
const localityOf = async (code: string): Promise<SearchLocality> => {
  const [row] = await db((tx) =>
    tx
      .select({ name: municipalities.name })
      .from(municipalities)
      .where(eq(municipalities.code, code)),
  );
  return { code, name: row!.name };
};

beforeAll(async () => {
  f = await createFixture(STATE);
  localityA = await localityOf(f.localityA);
  localityB = await localityOf(f.localityB);
  const [trade] = await db((tx) =>
    tx
      .insert(trades)
      .values({
        name: `Fonda / Comida Corrida · prueba ${STATE}`,
        slug: `giro-prueba-${STATE}-fonda-comida-corrida`,
      })
      .returning({ id: trades.id }),
  );
  fondaTrade = trade!.id;
});

afterAll(async () => {
  await cleanup(STATE);
});

/** Every match, however many: these tests look at what matches, not at pages. */
const EVERY_MATCH = { limit: 1_000, offset: 0 };

const search = (text: string, locality: SearchLocality = localityA) =>
  db((tx) => searchPublishedBusinesses(tx, locality, text, EVERY_MATCH));

/** The ids a search finds; fails the test when the query was treated as empty. */
const found = async (text: string, locality?: SearchLocality): Promise<string[]> => {
  const results = await search(text, locality);
  expect(results, `"${text}" was treated as empty`).not.toBeNull();
  return results!.map((result) => result.id);
};

const publish = (overrides: Partial<NewBusiness>) =>
  insertBusiness(f, { status: "published", publishedAt: new Date(), ...overrides });

const assignTrade = (businessId: string, tradeId: number) =>
  db((tx) => tx.insert(businessTrades).values({ businessId, tradeId }));

const getBusiness = async (id: string) =>
  (await db((tx) => tx.select().from(businesses).where(eq(businesses.id, id))))[0]!;

describe('The database derives the normalized name and "¿Qué ofreces?" of a business for the search (v2)', () => {
  it("creation with accents and capitals", async () => {
    const id = await insertBusiness(f, {
      name: "Plomería Güicho",
      whatYouOffer: "Destape de drenajes y BOMBAS de agua",
    });
    expect(await getBusiness(id)).toMatchObject({
      name: "Plomería Güicho",
      whatYouOffer: "Destape de drenajes y BOMBAS de agua",
      nameNormalized: "plomeria guicho",
      whatYouOfferNormalized: "destape de drenajes y bombas de agua",
    });
  });

  it('business without "¿Qué ofreces?"', async () => {
    const id = await publish({ name: "Herrería Los Compadres", whatYouOffer: null });
    expect(await getBusiness(id)).toMatchObject({ whatYouOffer: null, whatYouOfferNormalized: "" });
    expect(await found("herreria")).toContain(id);
    expect(await found("compadres portones")).toEqual([]);
  });

  it("a change of the name or of what it offers is searchable at once", async () => {
    const id = await publish({ name: "Vidriería El Cristal", whatYouOffer: "Cancelería" });
    await db((tx) =>
      tx
        .update(businesses)
        .set({ name: "Tapicería Doña Rosa", whatYouOffer: null })
        .where(eq(businesses.id, id)),
    );

    expect(await getBusiness(id)).toMatchObject({
      nameNormalized: "tapiceria dona rosa",
      whatYouOfferNormalized: "",
    });
    expect(await found("tapiceria")).toEqual([id]);
    expect(await found("vidrieria")).toEqual([]);
  });

  it("no write can set them", async () => {
    const id = await insertBusiness(f, { name: "Cerrajería Rápida" });
    // Drizzle leaves generated columns out of its writes; the database refuses
    // them too, whoever writes.
    for (const column of ["name_normalized", "what_you_offer_normalized"]) {
      const write = () =>
        db((tx) =>
          tx.execute(
            sql`UPDATE businesses SET ${sql.identifier(column)} = 'otra cosa' WHERE id = ${id}`,
          ),
        );
      expect(await pgErrorCode(write)).toBe("428C9");
    }
    expect((await getBusiness(id)).nameNormalized).toBe("cerrajeria rapida");
  });

  it("values consistent with their source", async () => {
    // The database writes the columns with `search_normalize`, and the query
    // normalizes what a resident types with `normalizeText`: every row of the
    // test database must agree with both.
    const rows = await db((tx) =>
      tx
        .select({
          id: businesses.id,
          name: businesses.name,
          whatYouOffer: businesses.whatYouOffer,
          nameNormalized: businesses.nameNormalized,
          whatYouOfferNormalized: businesses.whatYouOfferNormalized,
        })
        .from(businesses),
    );
    expect(rows.length).toBeGreaterThan(0);
    const outOfSync = rows.filter(
      (row) =>
        row.nameNormalized !== normalizeText(row.name) ||
        row.whatYouOfferNormalized !== normalizeText(row.whatYouOffer ?? ""),
    );
    expect(outOfSync).toEqual([]);
  });

  it("the normalized columns have trigram indexes", async () => {
    const indexes = await query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'businesses' AND indexdef LIKE '%gin_trgm_ops%'",
    );
    const definitions = indexes.map((row) => row.indexdef).join("\n");
    expect(definitions).toContain("USING gin (name_normalized gin_trgm_ops)");
    expect(definitions).toContain("USING gin (what_you_offer_normalized gin_trgm_ops)");
  });
});

describe("The registration leaves the card ready for the search", () => {
  it("registration with accents, findable later", async () => {
    const id = await insertBusiness(f, {
      name: "Plomería Güicho",
      whatYouOffer: "destape de drenajes",
    });
    expect(await found("plomeria")).not.toContain(id);

    await db((tx) =>
      tx
        .update(businesses)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(businesses.id, id)),
    );

    expect(await found("plomeria")).toContain(id);
    expect(await found("plomero")).toContain(id);
  });
});

describe("The search covers name, keywords and trades, and only what is published", () => {
  it("finds by keywords even if the category is another", async () => {
    const id = await publish({
      name: "Servicios Martínez",
      whatYouOffer: "plomería, destape de drenajes",
    });
    expect(await found("plomero")).toContain(id);
  });

  it("finds by business name", async () => {
    const id = await publish({
      name: "Tortillería La Esperanza",
      whatYouOffer: "tortillas de maíz y harina",
    });
    expect(await found("esperanza")).toEqual([id]);
  });

  it("finds by trade assigned by the admin", async () => {
    const id = await publish({ name: "Cocina Doña Mari", whatYouOffer: "desayunos y antojitos" });
    expect(await found("comida")).not.toContain(id);

    await assignTrade(id, fondaTrade);

    expect(await found("comida")).toContain(id);
    expect(await found("corrida")).toContain(id);
  });

  it("unpublished businesses never appear", async () => {
    const inReview = await insertBusiness(f, {
      name: "Azulejos del Valle",
      whatYouOffer: "azulejo y loseta",
    });
    const rejected = await insertBusiness(f, {
      name: "Azulejos Modernos",
      whatYouOffer: "azulejo para baño",
      status: "rejected",
      rejectedAt: new Date(),
      rejectionReason: "No es un negocio de la localidad",
    });
    await assignTrade(inReview, fondaTrade);
    await assignTrade(rejected, fondaTrade);

    expect(await found("azulejo")).toEqual([]);
    const byTrade = await found("comida");
    expect(byTrade).not.toContain(inReview);
    expect(byTrade).not.toContain(rejected);
  });

  it("published business without trades", async () => {
    const id = await publish({ name: "Papelería El Lápiz", whatYouOffer: "copias e impresiones" });
    expect(await found("papeleria")).toEqual([id]);
    expect(await found("copias")).toEqual([id]);
  });
});

describe("Public URLs carry the state and the municipality (v2)", () => {
  it("a search finds only the published businesses of its locality", async () => {
    const elsewhere = await publish({
      localityCode: f.localityB,
      zoneId: f.zoneB,
      name: "Carpintería El Roble",
      whatYouOffer: "muebles de madera",
    });
    expect(await found("roble")).toEqual([]);
    expect(await found("roble", localityB)).toEqual([elsewhere]);
  });
});

describe("Only what is published is shown", () => {
  it("the query never returns a card once it is unpublished", async () => {
    const id = await publish({ name: "Lavandería Burbujas", whatYouOffer: "lavado por kilo" });
    expect(await found("lavanderia")).toEqual([id]);

    await db((tx) =>
      tx
        .update(businesses)
        .set({
          status: "in_review",
          unpublishedAt: new Date(),
          unpublishReason: "Datos por confirmar",
        })
        .where(eq(businesses.id, id)),
    );

    expect(await found("lavanderia")).toEqual([]);
  });
});

describe("An edit awaiting review does not show through on any public surface", () => {
  it("the search does not find what is proposed", async () => {
    const id = await publish({ name: "Estética Lupita", whatYouOffer: "cortes y peinados" });
    await db((tx) =>
      tx.insert(pendingEdits).values({
        businessId: id,
        localityCode: f.localityA,
        name: "Estética Lupita y Asociados",
        categoryId: f.categoryId,
        whatsapp: fakePhone(),
        zoneId: f.zoneA,
        whatYouOffer: "cortes, peinados y asociados",
      }),
    );

    expect(await found("asociados")).toEqual([]);
    expect(await found("estetica")).toContain(id);
  });
});

describe("Case- and accent-insensitive matching, and partial by word stem", () => {
  it("case and accents do not matter", async () => {
    const lower = await found("plomeria");
    expect(lower.length).toBeGreaterThan(0);
    expect(await found("PLOMERÍA")).toEqual(lower);
    expect(await found("Plomería")).toEqual(lower);
  });

  it('"plomero" finds "plomería"', async () => {
    const accented = await publish({
      name: "Destapes Rápidos",
      whatYouOffer: "plomería en general",
    });
    const plain = await publish({ name: "Fugas y Más", whatYouOffer: "plomeria y gas" });
    const results = await found("plomero");
    expect(results).toContain(accented);
    expect(results).toContain(plain);
  });

  it('"futbol" finds the "fútbol" club', async () => {
    const id = await publish({
      name: "Club Deportivo Halcones",
      whatYouOffer: "fútbol infantil de 6 a 12 años",
    });
    expect(await found("futbol")).toContain(id);
  });

  it("several words are all required", async () => {
    const both = await publish({ name: "Escuela Gol de Oro", whatYouOffer: "fútbol infantil" });
    const one = await publish({ name: "Liga Veteranos", whatYouOffer: "fútbol para adultos" });
    const results = await found("futbol infantil");
    expect(results).toContain(both);
    expect(results).not.toContain(one);
  });

  it("each word may match in a different place", async () => {
    const id = await publish({ name: "Antojitos La Güera", whatYouOffer: "quesadillas y sopes" });
    await assignTrade(id, fondaTrade);
    expect(await found("guera comida")).toEqual([id]);
    expect(await found("sopes corrida")).toEqual([id]);
    expect(await found("guera pozole")).toEqual([]);
  });

  it('the "ñ" does not break the search', async () => {
    const id = await publish({ name: "Fiesta Alegre", whatYouOffer: "piñatas y dulceros" });
    expect(await found("pinatas")).toEqual([id]);
    expect(await found("piñatas")).toEqual([id]);
  });

  it("filler words do not reduce the results", async () => {
    const id = await publish({
      name: "Cerrajería Llave Maestra",
      whatYouOffer: "duplicado de llaves",
    });
    const alone = await found("cerrajeria");
    expect(alone).toContain(id);
    expect(await found(`cerrajeria en ${localityA.name}`)).toEqual(alone);
    expect(await found("quien me arregla la cerrajeria")).toEqual(alone);
  });

  it("query of only filler words", async () => {
    // Searched as is: the page shows "no businesses found", not the empty-query notice.
    expect(await search("quien me")).toEqual([]);
    expect(await search("necesito uno")).toEqual([]);
  });

  it("trade names compare with the same normalization as the query", async () => {
    const samples = [
      "Fonda / Comida Corrida",
      "Plomería",
      "Cerrajería",
      "PIÑATERÍA",
      "Pingüinos Útiles",
      "Clases de fútbol (6–12 años)",
      "Óptica, Ámbar & Ébano",
    ];
    const rows = await db(async (tx) =>
      Promise.all(
        samples.map(async (sample) => {
          const result = await tx.execute(sql`SELECT ${normalizedSql(sql`${sample}::text`)} AS v`);
          return (result.rows[0] as { v: string }).v;
        }),
      ),
    );
    expect(rows).toEqual(samples.map(normalizeText));
  });
});

describe("The name of the locality is a filler word of its own search (v2)", () => {
  it("the name of the locality being searched", async () => {
    const alone = await found("cerrajeria");
    expect(alone.length).toBeGreaterThan(0);
    expect(await found(`cerrajeria en ${localityA.name}`)).toEqual(alone);
    expect(await found(`${localityA.name.toUpperCase()} cerrajería`)).toEqual(alone);
  });

  it("the name of another locality", async () => {
    // Locality B is "Pueblo Dos": "pueblo" is also a word of A's name, "dos" is not.
    const id = await publish({ name: "Cerrajería Los Dos Hermanos", whatYouOffer: "chapas" });
    expect((await found("cerrajeria")).length).toBeGreaterThan(1);
    expect(await found(`cerrajeria ${localityB.name}`)).toEqual([id]);
  });
});

describe("Empty query and hostile terms bounded, without error", () => {
  it("empty or only-spaces query", async () => {
    for (const text of ["", " ", "     ", "\t\n"]) expect(await search(text)).toBeNull();
  });

  it("extremely long query", async () => {
    expect(await found("plomero ".repeat(5_000))).toEqual(await found("plomero"));
    expect(await found("x".repeat(100_000))).toEqual([]);
  });

  it("characters that would be wildcards in a search", async () => {
    for (const text of ["%", "_", "%%", "%_%", "\\"]) expect(await search(text)).toBeNull();
  });

  it("odd alphabets and symbols", async () => {
    for (const text of ["🎉🎈", "Привет", "日本語", "\u0000"])
      expect(await search(text)).toBeNull();
  });

  it("quotes, markup and SQL are only text", async () => {
    const plumbers = await found("plomero");
    expect(await found("<b>plomero</b>")).toEqual(plumbers);
    expect(await found("plomero\u0000")).toEqual(plumbers);
    for (const text of ["'; DROP TABLE businesses; --", `" OR 1=1 --`, "a'b\"c", "%plom%"]) {
      // Answers without a database error, with or without results.
      const results = await search(text);
      expect(results === null || Array.isArray(results), text).toBe(true);
    }
    expect(
      (await query<{ n: number }>("SELECT count(*)::int AS n FROM businesses"))[0]!.n,
    ).toBeGreaterThan(0);
  });
});

describe("Results page with the same cards as the listing", () => {
  it("deterministic order", async () => {
    const older = await publish({
      name: "Huaraches Zamora",
      publishedAt: new Date("2026-05-01T12:00:00Z"),
    });
    const sameDay = new Date("2026-05-03T12:00:00Z");
    const second = await publish({ name: "Huaraches Beto", publishedAt: sameDay });
    const first = await publish({ name: "Huaraches Arce", publishedAt: sameDay });

    expect(await found("huaraches")).toEqual([first, second, older]);
    expect(await found("huaraches")).toEqual([first, second, older]);
  });

  it("each result carries what the listing card shows, and nothing internal", async () => {
    const catalogue = await publish({
      name: "Sastrería Fina",
      whatYouOffer: "ajustes y composturas",
      homeDelivery: true,
      photoKey: `searchphoto${STATE}`,
    });
    const other = await publish({
      name: "Sastrería Rápida",
      zoneId: null,
      zoneOther: "Rinconada del Venado",
    });
    const results = (await search("sastreria"))!;
    const byId = new Map(results.map((result) => [result.id, result]));
    const [category] = await query<{ slug: string }>(
      `SELECT slug FROM categories WHERE id = ${f.categoryId}`,
    );

    expect(byId.get(catalogue)).toEqual({
      id: catalogue,
      name: "Sastrería Fina",
      categorySlug: category!.slug,
      zoneName: "Centro",
      zoneSlug: "centro",
      homeDelivery: true,
      whatsapp: expect.stringMatching(/^771999\d{4}$/),
      photoKey: `searchphoto${STATE}`,
    } satisfies SearchResult);
    expect(byId.get(other)).toMatchObject({
      zoneName: "Rinconada del Venado",
      zoneSlug: null,
      homeDelivery: false,
      photoKey: null,
    });
  });
});

describe('Directory lists show 20 cards per page, with "Ver más" to the next (v2)', () => {
  it("a page reads one row more than it shows, and the next page continues it", async () => {
    const total = PAGE_SIZE + 5;
    const base = Date.parse("2026-06-01T12:00:00Z");
    const ids: string[] = [];
    for (let n = 0; n < total; n++) {
      ids.push(
        await publish({
          name: `Tamalería Paginada ${String(n).padStart(2, "0")}`,
          // One a minute: the most recent first.
          publishedAt: new Date(base + n * 60_000),
        }),
      );
    }
    const page = (number: number) =>
      db((tx) => searchPublishedBusinesses(tx, localityA, "tamaleria paginada", pageSlice(number)));

    const first = (await page(1))!.map((result) => result.id);
    const second = (await page(2))!.map((result) => result.id);
    const third = await page(3);

    const newestFirst = ids.toReversed();
    // Page 1 reads 21 rows: the 21st only says that page 2 exists.
    expect(first).toEqual(newestFirst.slice(0, PAGE_SIZE + 1));
    // Page 2 starts after the 20 that page 1 shows, and is the last one.
    expect(second).toEqual(newestFirst.slice(PAGE_SIZE));
    expect(second.length).toBeLessThanOrEqual(PAGE_SIZE);
    expect(third).toEqual([]);
  });
});
