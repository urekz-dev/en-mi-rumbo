// docs/specs/data-model.md, requirement "Zones belong to a locality and are
// loaded from the SEPOMEX postal catalogue (v2)": how
// scripts/catalogues/sepomex.ts reads SEPOMEX's file, cleans the names and
// chooses the slugs, and that the data migration credits SEPOMEX. What the
// migration leaves in the database is tested in test/worker/zones.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  buildZones,
  decodeSepomex,
  parseSepomex,
  type Settlement,
  ZONE_SLUGS,
  zonesSql,
} from "../../scripts/catalogues/sepomex-zones.ts";

const migration = readFileSync(
  new URL("../../drizzle/0006_tizayuca_zones.sql", import.meta.url),
  "utf8",
);

/** The message of the error `run` throws. */
function failure(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected an error");
}

// SEPOMEX's TXT file: a notice, a header and one line per settlement. The
// municipalities of the fictitious state 94 are not in INEGI's catalogue.
const HEADER =
  "d_codigo|d_asenta|d_tipo_asenta|D_mnpio|d_estado|d_ciudad|d_CP|c_estado|c_oficina|" +
  "c_tipo_asenta|c_mnpio|id_asenta_cpcons|d_zona|c_cve_ciudad|c_CP";
const line = (postalCode: string, name: string, type: string, municipality = "001") =>
  `${postalCode}|${name}|${type}|Pueblo de Prueba|Estado de Prueba||${postalCode}|94|` +
  `${postalCode}|09|${municipality}|0001|Urbano||`;
const file = (...lines: string[]) =>
  [
    "El Catálogo Nacional de Códigos Postales, es elaborado por Correos de México.",
    HEADER,
    ...lines,
    "",
  ].join("\r\n");

const settlement = (name: string, type = "Colonia", postalCode = "99000"): Settlement => ({
  municipalityCode: "94001",
  municipality: "Pueblo de Prueba",
  state: "Estado de Prueba",
  postalCode,
  name,
  type,
});
const zonesOf = (...settlements: Settlement[]) => buildZones(settlements, "94001");

describe("Zones belong to a locality and are loaded from the SEPOMEX postal catalogue (v2)", () => {
  it("the migration credits SEPOMEX", () => {
    expect(migration).toMatch(
      /^-- Fuente: Servicio Postal Mexicano \(Correos de México\), Catálogo Nacional de Códigos Postales, última actualización [0-9]{4}-[0-9]{2}-[0-9]{2}\.$/m,
    );
    expect(migration).toMatch(
      /^-- https:\/\/www\.correosdemexico\.gob\.mx\/SSLServicios\/ConsultaCP\/CodigoPostal_Exportar\.aspx$/m,
    );
  });

  it("postal codes are not stored", () => {
    const values = migration.slice(migration.indexOf("VALUES"));
    // The only five digits are the locality's code.
    expect(new Set(values.match(/[0-9]{5}/g))).toEqual(new Set(["13069"]));
    expect(zonesSql(zonesOf(settlement("Centro")), "94001", "2026-10-13").split("VALUES")[1]).toBe(
      "\n  ('94001', 'Colonia', 'Centro', 'centro');\n",
    );
  });

  it("SEPOMEX's TXT file is read in ISO-8859-1 or in UTF-8", () => {
    const text = file(
      line("99001", "San Ángel", "Fraccionamiento"),
      line("99002", "La Cañada", "Colonia", "002"),
    );
    const latin1 = Uint8Array.from(text, (char) => char.charCodeAt(0));
    expect(decodeSepomex(latin1)).toEqual({ text, encoding: "Windows-1252" });
    expect(decodeSepomex(new TextEncoder().encode(text))).toEqual({ text, encoding: "UTF-8" });

    const common = { municipality: "Pueblo de Prueba", state: "Estado de Prueba" };
    expect(parseSepomex(text)).toEqual([
      {
        ...common,
        municipalityCode: "94001",
        postalCode: "99001",
        name: "San Ángel",
        type: "Fraccionamiento",
      },
      {
        ...common,
        municipalityCode: "94002",
        postalCode: "99002",
        name: "La Cañada",
        type: "Colonia",
      },
    ]);
    expect(() => parseSepomex("d_asenta|d_tipo_asenta\r\nCentro|Colonia")).toThrow(
      /no header line/,
    );
  });

  it("only the settlements of the municipality become its zones", () => {
    const settlements = parseSepomex(
      file(line("99001", "Centro", "Colonia"), line("99002", "La Cañada", "Colonia", "002")),
    );
    expect(buildZones(settlements, "94002").zones).toEqual([
      { type: "Colonia", name: "La Cañada", slug: "la-canada" },
    ]);
    expect(failure(() => buildZones(settlements, "94003"))).toContain(
      'the catalogue has no settlement of municipality "94003"',
    );
  });

  it("names keep SEPOMEX's spelling, without stray spaces", () => {
    const built = zonesOf(
      settlement("  Rancho  la   Purísima ", "Fraccionamiento"),
      settlement("C.T.M."),
      settlement("Ex-Presidentes Municipales", "Fraccionamiento"),
      settlement("Ciudad de los Niños (Rosas Rojas)"),
      settlement("Don Carlos 2da. Sección", " Unidad  habitacional "),
    );
    expect(built.zones).toEqual([
      {
        type: "Colonia",
        name: "Ciudad de los Niños (Rosas Rojas)",
        slug: "ciudad-de-los-ninos-rosas-rojas",
      },
      { type: "Colonia", name: "C.T.M.", slug: "ctm" },
      {
        type: "Unidad habitacional",
        name: "Don Carlos 2da. Sección",
        slug: "don-carlos-2da-seccion",
      },
      {
        type: "Fraccionamiento",
        name: "Ex-Presidentes Municipales",
        slug: "ex-presidentes-municipales",
      },
      { type: "Fraccionamiento", name: "Rancho la Purísima", slug: "rancho-la-purisima" },
    ]);
    expect(built).toMatchObject({ settlements: 5, merges: [], fixes: [], chosen: [] });
  });

  it("text decoded twice is fixed and reported", () => {
    // UTF-8 read as Windows-1252: í, Á and É.
    const built = zonesOf(
      settlement("Rancho la PurÃ­sima", "Fraccionamiento", "99001"),
      settlement("Ã\u0081lamos", "Colonia", "99002"),
      settlement("Ã‰xito", "RancherÃ­a", "99003"),
    );
    expect(built.zones.map(({ type, name }) => [type, name])).toEqual([
      ["Colonia", "Álamos"],
      ["Ranchería", "Éxito"],
      ["Fraccionamiento", "Rancho la Purísima"],
    ]);
    expect(built.fixes).toEqual([
      '99001: "Rancho la PurÃ­sima" is "Rancho la Purísima"',
      '99002: "Ã\u0081lamos" is "Álamos"',
      '99003: "Ã‰xito" is "Éxito"',
      '99003: "RancherÃ­a" is "Ranchería"',
    ]);
  });

  it("a letter lost to the encoding stops the generation", () => {
    const message = failure(() =>
      zonesOf(settlement("Pur�sima", "Colonia", "99001"), settlement("Centro")),
    );
    expect(message).toContain('99001: "Pur�sima" lost a letter to the encoding');
  });

  it("no duplicates after the cleanup", () => {
    const built = zonesOf(
      settlement("San Ángel", "Fraccionamiento", "99001"),
      settlement("San Angel", "Fraccionamiento", "99002"),
      settlement("SAN ÁNGEL", "Fraccionamiento", "99003"),
      settlement("San  Ángel", "Fraccionamiento", "99001"),
      // Neither accents nor case tell them apart: the most frequent wins.
      settlement("La joya", "Colonia", "99004"),
      settlement("La Joya", "Colonia", "99005"),
      settlement("La Joya", "Colonia", "99006"),
    );
    expect(built.zones).toEqual([
      { type: "Colonia", name: "La Joya", slug: "la-joya" },
      { type: "Fraccionamiento", name: "San Ángel", slug: "san-angel" },
    ]);
    expect(built.merges).toEqual([
      '"San Ángel" (Fraccionamiento) also as "San Angel" (99002), "SAN ÁNGEL" (99003)',
      '"La Joya" (Colonia) also as "La joya" (99004)',
    ]);
  });

  it("a name with two settlement types stops the generation", () => {
    const centro = [
      settlement("Centro", "Colonia", "99000"),
      settlement("Centro", "Barrio", "99001"),
    ];
    const message = failure(() => buildZones(centro, "94001", []));
    expect(message).toContain(
      'one name with 2 settlement types: "Centro" (Colonia, 99000), "Centro" (Barrio, 99001); ' +
        "choose a slug for each in ZONE_SLUGS",
    );
    // A slug for only one of them is not enough.
    expect(
      failure(() =>
        buildZones(centro, "94001", [{ name: "Centro", type: "Colonia", slug: "colonia-centro" }]),
      ),
    ).toContain("one name with 2 settlement types");

    const built = buildZones(centro, "94001", [
      { name: "Centro", type: "Colonia", slug: "colonia-centro" },
      { name: "Centro", type: "Barrio", slug: "barrio-centro" },
    ]);
    expect(built.zones).toEqual([
      { type: "Barrio", name: "Centro", slug: "barrio-centro" },
      { type: "Colonia", name: "Centro", slug: "colonia-centro" },
    ]);
    expect(built.chosen).toEqual([
      '"Centro" (Colonia) is colonia-centro, "Centro" (Barrio) is barrio-centro',
    ]);
  });

  it("a slug chosen for a settlement SEPOMEX no longer lists stops the generation", () => {
    const message = failure(() =>
      buildZones([settlement("Centro")], "94001", [
        { name: "Centro", type: "Pueblo", slug: "pueblo-centro" },
        { name: "Centro", type: "Colonia", slug: "Centro" },
      ]),
    );
    expect(message).toContain(
      'a slug was chosen for "Centro" (Pueblo), which SEPOMEX does not list in 94001',
    );
    expect(message).toContain('"Centro" (Colonia): "Centro" is not a slug');
  });

  it("a slug collision stops the generation, naming every one", () => {
    const message = failure(() =>
      buildZones(
        [
          settlement("C.T.M.", "Colonia", "99000"),
          settlement("CTM", "Colonia", "99001"),
          settlement("Ex-Presidentes", "Fraccionamiento", "99002"),
          settlement("Ex Presidentes", "Colonia", "99003"),
          settlement("Centro", "Colonia", "99004"),
          settlement("Primero de Mayo", "Barrio", "99005"),
          settlement("Łódź", "Colonia", "99006"),
        ],
        "94001",
        [{ name: "Primero de Mayo", type: "Barrio", slug: "centro" }],
      ),
    );
    expect(message).toContain(
      'slug collision: "ctm" for "C.T.M." (Colonia, 99000), "CTM" (Colonia, 99001)',
    );
    expect(message).toContain(
      'slug collision: "ex-presidentes" for "Ex-Presidentes" (Fraccionamiento, 99002), ' +
        '"Ex Presidentes" (Colonia, 99003)',
    );
    // A chosen slug collides like any other.
    expect(message).toContain(
      'slug collision: "centro" for "Centro" (Colonia, 99004), "Primero de Mayo" (Barrio, 99005)',
    );
    expect(message).toContain('99006: no slug for "Łódź"');
    expect(message).toMatch(/^SEPOMEX zones of 94001: 4 problem\(s\)/);
  });

  it("the repeated names of Tizayuca take the slugs chosen by hand", () => {
    const chosen = ZONE_SLUGS["13069"] ?? [];
    const settlements = chosen.map(({ name, type }) => ({
      ...settlement(name, type),
      municipalityCode: "13069",
    }));
    const message = failure(() => buildZones(settlements, "13069", []));
    for (const name of ["El Carmen", "El Chopo", "El Manantial", "Tizayuca"]) {
      expect(message).toContain(`one name with 2 settlement types: "${name}"`);
    }

    const { zones } = buildZones(settlements, "13069");
    expect(zones.map(({ name, type, slug }) => ({ name, type, slug }))).toEqual(
      chosen.toSorted((a, b) => (a.slug < b.slug ? -1 : 1)),
    );
  });
});
