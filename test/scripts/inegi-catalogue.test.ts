// docs/specs/data-model.md, requirement "The catalogue of states and
// municipalities is reference data and only active localities are served
// (v2)": how scripts/catalogues/inegi.ts reads INEGI's files and chooses the
// slugs, and that the data migration credits INEGI. What the migration leaves
// in the database is tested in test/worker/locality.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  buildCatalogue,
  entriesFromCsv,
  MUNICIPALITY_SLUGS,
  STATE_SLUGS,
} from "../../scripts/catalogues/inegi-catalogue.ts";
import { slugify } from "../../scripts/catalogues/slug.ts";

const migration = readFileSync(
  new URL("../../drizzle/0003_inegi_catalogue.sql", import.meta.url),
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

describe("The catalogue of states and municipalities is reference data and only active localities are served (v2)", () => {
  it("the migration credits INEGI", () => {
    expect(migration).toMatch(
      /^-- Fuente: INEGI, Catálogo Único de Claves de Áreas Geoestadísticas Estatales, Municipales y Localidades, fecha de corte [0-9]{4}-[0-9]{2}\.$/m,
    );
  });

  it("INEGI's codes and names are kept as they are", () => {
    const statesCsv = 'CVEGEO,CVE_ENT,NOM_ENT,NOM_ABR\r\n"13","13","Hidalgo","Hgo."\r\n';
    const municipalitiesCsv =
      "CVEGEO,CVE_ENT,NOM_ENT,CVE_MUN,NOM_MUN\r\n" +
      '"20549","20","Oaxaca","549","Heroica Villa Tezoatlán de Segura y Luna, Cuna de la Independencia de Oaxaca"\r\n' +
      '"13069","13","Hidalgo","069","Tizayuca"\r\n';

    expect(entriesFromCsv(statesCsv, municipalitiesCsv)).toEqual({
      states: [{ code: "13", name: "Hidalgo" }],
      municipalities: [
        { code: "13069", name: "Tizayuca" },
        {
          code: "20549",
          name: "Heroica Villa Tezoatlán de Segura y Luna, Cuna de la Independencia de Oaxaca",
        },
      ],
    });
  });

  it.for([
    ["Tizayuca", "tizayuca"],
    ["San Luis Potosí", "san-luis-potosi"],
    ["San Juan Ñumí", "san-juan-numi"],
    ["Güémez", "guemez"],
    ["Dr. Belisario Domínguez", "dr-belisario-dominguez"],
    [
      "Heroica Villa Tezoatlán de Segura y Luna, Cuna de la Independencia de Oaxaca",
      "heroica-villa-tezoatlan-de-segura-y-luna-cuna-de-la-independencia-de-oaxaca",
    ],
    ["Ahualulco del Sonido 13", "ahualulco-del-sonido-13"],
    [" Santa  María–del Oro ", "santa-maria-del-oro"],
  ])("slugs drop accents and punctuation (%s)", ([name, slug]) => {
    expect(slugify(name!)).toBe(slug);
  });

  it("a name without a slug in ASCII stops the generation", () => {
    expect(() => slugify("Łódź")).toThrow(/no slug for "Łódź"/);
    expect(() => slugify("...")).toThrow();
  });

  it("a slug collision stops the generation, naming every one", () => {
    const message = failure(() =>
      buildCatalogue(
        {
          states: [
            { code: "20", name: "Oaxaca" },
            { code: "21", name: "Puebla" },
          ],
          municipalities: [
            { code: "20001", name: "San Juan" },
            { code: "20002", name: "San Juán" },
            { code: "20003", name: "Santa Cruz" },
            { code: "20004", name: "Santa  Cruz" },
            { code: "21001", name: "San Juan" },
          ],
        },
        { states: {}, municipalities: {} },
      ),
    );

    expect(message).toContain(
      'slug collision among the municipalities of Oaxaca: "san-juan" for 20001 San Juan, 20002 San Juán',
    );
    expect(message).toContain('"santa-cruz" for 20003 Santa Cruz, 20004 Santa  Cruz');
    // The same name in another state is not a collision.
    expect(message).not.toContain("21001");
  });

  it("the repeated names of Oaxaca take the slugs chosen by hand", () => {
    const oaxaca = {
      states: [{ code: "20", name: "Oaxaca" }],
      municipalities: Object.entries(MUNICIPALITY_SLUGS).map(([code, { name }]) => ({
        code,
        name,
      })),
    };
    const message = failure(() => buildCatalogue(oaxaca, { states: {}, municipalities: {} }));
    expect(message).toContain(
      '"san-juan-mixtepec" for 20208 San Juan Mixtepec, 20209 San Juan Mixtepec',
    );
    expect(message).toContain(
      '"san-pedro-mixtepec" for 20318 San Pedro Mixtepec, 20319 San Pedro Mixtepec',
    );

    const { municipalities } = buildCatalogue(oaxaca, {
      states: {},
      municipalities: MUNICIPALITY_SLUGS,
    });
    expect(Object.fromEntries(municipalities.map((m) => [m.code, m.slug]))).toEqual(
      Object.fromEntries(
        Object.entries(MUNICIPALITY_SLUGS).map(([code, { slug }]) => [code, slug]),
      ),
    );
  });

  it("a slug chosen for a name INEGI no longer uses stops the generation", () => {
    const message = failure(() =>
      buildCatalogue(
        { states: [{ code: "05", name: "Coahuila" }], municipalities: [] },
        { states: STATE_SLUGS, municipalities: {} },
      ),
    );
    expect(message).toContain(`but INEGI's name is now "Coahuila"`);
    expect(message).toContain("state 09: has a slug chosen but is missing");
  });
});
