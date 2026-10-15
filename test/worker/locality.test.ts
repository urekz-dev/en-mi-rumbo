// Scenarios of docs/specs/data-model.md about the INEGI catalogue and the
// localities, against the database the migrations leave (the catalogue and
// Tizayuca come from drizzle/0003_inegi_catalogue.sql), and the function the
// public routes use to resolve `/{estado}/{municipio}` (src/core/locality).
import { and, count, eq, lte } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { localities, municipalities, states } from "../../src/core/db/schema/index.ts";
import { servedLocality } from "../../src/core/locality/served.ts";
import { cleanup, createFixture, db, type Fixture } from "./fixtures.ts";

const STATE = "96";
const STATE_SLUG = `estado-de-prueba-${STATE}`;
let f: Fixture;

beforeAll(async () => {
  f = await createFixture(STATE);
});

afterAll(async () => {
  await cleanup(STATE);
});

const served = (stateSlug: string, municipalitySlug: string) =>
  db((tx) => servedLocality(tx, stateSlug, municipalitySlug));

const setActive = (code: string, active: boolean) =>
  db((tx) => tx.update(localities).set({ active }).where(eq(localities.code, code)));

describe("The locality is a first-class record keyed by the INEGI municipality code (v2)", () => {
  it("Tizayuca as a locality, inactive and without a contact WhatsApp", async () => {
    const [row] = await db((tx) =>
      tx
        .select({
          code: localities.code,
          name: municipalities.name,
          slug: municipalities.slug,
          stateName: states.name,
          stateSlug: states.slug,
          timeZone: localities.timeZone,
          contactWhatsapp: localities.contactWhatsapp,
          dailyRegistrationThreshold: localities.dailyRegistrationThreshold,
          active: localities.active,
          latitude: localities.latitude,
          longitude: localities.longitude,
        })
        .from(localities)
        .innerJoin(municipalities, eq(municipalities.code, localities.code))
        .innerJoin(states, eq(states.code, municipalities.stateCode))
        .where(eq(localities.code, "13069")),
    );

    expect(row).toEqual({
      code: "13069",
      name: "Tizayuca",
      slug: "tizayuca",
      stateName: "Hidalgo",
      stateSlug: "hidalgo",
      timeZone: "America/Mexico_City",
      contactWhatsapp: null,
      dailyRegistrationThreshold: null,
      active: false,
      // Its municipal seat, INEGI's locality 130690001
      // (drizzle/0009_tizayuca_coordinates.sql).
      latitude: 19.8410889,
      longitude: -98.9815842,
    });
  });
});

describe("The catalogue of states and municipalities is reference data and only active localities are served (v2)", () => {
  it("the catalogue is complete and sluggable", async () => {
    // Other test files add fictitious states above INEGI's 32 while this runs.
    const real = await db((tx) =>
      tx.select().from(states).where(lte(states.code, "32")).orderBy(states.code),
    );
    expect(real.map((state) => state.code)).toEqual(
      Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
    expect(real.find((state) => state.code === "13")).toEqual({
      code: "13",
      name: "Hidalgo",
      slug: "hidalgo",
    });

    const [total] = await db((tx) =>
      tx.select({ n: count() }).from(municipalities).where(lte(municipalities.stateCode, "32")),
    );
    expect(total?.n).toBe(2478);

    const [tizayuca] = await db((tx) =>
      tx
        .select({ code: municipalities.code, name: municipalities.name })
        .from(municipalities)
        .where(and(eq(municipalities.stateCode, "13"), eq(municipalities.slug, "tizayuca"))),
    );
    expect(tizayuca).toEqual({ code: "13069", name: "Tizayuca" });
  });

  it("state slugs: the official name, or the common short name of five states", async () => {
    const real = await db((tx) =>
      tx.select().from(states).where(lte(states.code, "32")).orderBy(states.code),
    );
    expect(Object.fromEntries(real.map((state) => [state.code, state.slug]))).toEqual({
      "01": "aguascalientes",
      "02": "baja-california",
      "03": "baja-california-sur",
      "04": "campeche",
      "05": "coahuila",
      "06": "colima",
      "07": "chiapas",
      "08": "chihuahua",
      "09": "ciudad-de-mexico",
      "10": "durango",
      "11": "guanajuato",
      "12": "guerrero",
      "13": "hidalgo",
      "14": "jalisco",
      "15": "estado-de-mexico",
      "16": "michoacan",
      "17": "morelos",
      "18": "nayarit",
      "19": "nuevo-leon",
      "20": "oaxaca",
      "21": "puebla",
      "22": "queretaro",
      "23": "quintana-roo",
      "24": "san-luis-potosi",
      "25": "sinaloa",
      "26": "sonora",
      "27": "tabasco",
      "28": "tamaulipas",
      "29": "tlaxcala",
      "30": "veracruz",
      "31": "yucatan",
      "32": "zacatecas",
    });
    // The official names stay as INEGI writes them.
    expect(real.find((state) => state.code === "15")?.name).toBe("México");
  });

  it("the repeated names of Oaxaca carry their district", async () => {
    const rows = await db((tx) =>
      tx
        .select({ code: municipalities.code, slug: municipalities.slug })
        .from(municipalities)
        .where(eq(municipalities.stateCode, "20")),
    );
    const slugs = Object.fromEntries(rows.map((row) => [row.code, row.slug]));
    expect(slugs).toMatchObject({
      "20208": "san-juan-mixtepec-distrito-08",
      "20209": "san-juan-mixtepec-distrito-26",
      "20318": "san-pedro-mixtepec-distrito-22",
      "20319": "san-pedro-mixtepec-distrito-26",
    });
  });

  it("an active locality is served with its data", async () => {
    expect(await served(STATE_SLUG, "pueblo-uno")).toEqual({
      code: f.localityA,
      name: "Pueblo Uno",
      slug: "pueblo-uno",
      state: { code: STATE, name: `Estado de prueba ${STATE}`, slug: STATE_SLUG },
      timeZone: "America/Mexico_City",
      contactWhatsapp: "7719990001",
      // Other test files activate their own fixture localities meanwhile;
      // test/worker/locality-routes.test.ts checks this flag.
      othersActive: expect.any(Boolean),
      seat: null,
    });
  });

  it("a municipality without an active locality is not served", async () => {
    // A locality with the active flag off.
    expect(await served(STATE_SLUG, "pueblo-dos")).toBeNull();
    // Tizayuca, until a super admin activates it.
    expect(await served("hidalgo", "tizayuca")).toBeNull();
    // A municipality of the catalogue without a locality.
    expect(await served("hidalgo", "pachuca-de-soto")).toBeNull();
  });

  it("activating a locality is data only", async () => {
    await setActive(f.localityB, true);
    try {
      expect(await served(STATE_SLUG, "pueblo-dos")).toMatchObject({
        code: f.localityB,
        contactWhatsapp: "7719990002",
      });
    } finally {
      await setActive(f.localityB, false);
    }
    expect(await served(STATE_SLUG, "pueblo-dos")).toBeNull();
  });
});

// docs/specs/public-directory.md: the routes answer 404 when servedLocality
// returns null; they arrive with the public directory.
describe("Unknown or inactive state and municipality answer 404 (v2)", () => {
  it("a state that does not exist", async () => {
    expect(await served("atlantida", "tizayuca")).toBeNull();
    expect(await served("atlantida", "pueblo-uno")).toBeNull();
  });

  it("a municipality under the wrong state", async () => {
    expect(await served("jalisco", "tizayuca")).toBeNull();
    expect(await served("hidalgo", "pueblo-uno")).toBeNull();
  });

  it("a segment that cannot be a slug", async () => {
    expect(await served(STATE_SLUG.toUpperCase(), "pueblo-uno")).toBeNull();
    expect(await served(STATE_SLUG, "pueblo-uno/")).toBeNull();
    expect(await served(STATE_SLUG, "")).toBeNull();
  });
});
