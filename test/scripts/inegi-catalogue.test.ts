// docs/specs/data-model.md, requirement "The catalogue of states and
// municipalities is reference data and only active localities are served
// (v2)": the data migration is exactly what scripts/catalogues/inegi.ts
// generates from the committed extract, and its slugs follow the rules.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  buildCatalogue,
  catalogueSql,
  type Extract,
  extractEntries,
  extractJson,
  MUNICIPALITY_SLUGS,
  slugify,
  STATE_SLUGS,
} from "../../scripts/catalogues/inegi-catalogue.ts";

const EXTRACT = new URL("../../scripts/catalogues/inegi.json", import.meta.url);
const extract = JSON.parse(readFileSync(EXTRACT, "utf8")) as Extract;
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
  it("the migration matches its extract", () => {
    expect(catalogueSql(extract)).toBe(migration);
  });

  it("the extract is written as the extract step writes it", () => {
    expect(extractJson(extract)).toBe(readFileSync(EXTRACT, "utf8"));
  });

  it("the extract names its source and the credit INEGI asks for", () => {
    expect(extract.source.files.map((file) => file.url)).toEqual([
      "https://www.inegi.org.mx/contenidos/app/ageeml/catun_entidad.zip",
      "https://www.inegi.org.mx/contenidos/app/ageeml/catun_municipio.zip",
    ]);
    expect(extract.source.attribution).toMatch(
      /^Fuente: INEGI, Catálogo Único de Claves de Áreas Geoestadísticas Estatales, Municipales y Localidades, fecha de corte [0-9]{4}-[0-9]{2}\.$/,
    );
    expect(migration).toContain(`-- ${extract.source.attribution}\n`);
  });

  it("the extract keeps INEGI's codes and names as they are", () => {
    const statesCsv = 'CVEGEO,CVE_ENT,NOM_ENT,NOM_ABR\r\n"13","13","Hidalgo","Hgo."\r\n';
    const municipalitiesCsv =
      "CVEGEO,CVE_ENT,NOM_ENT,CVE_MUN,NOM_MUN\r\n" +
      '"20549","20","Oaxaca","549","Heroica Villa Tezoatlán de Segura y Luna, Cuna de la Independencia de Oaxaca"\r\n' +
      '"13069","13","Hidalgo","069","Tizayuca"\r\n';

    expect(extractEntries(statesCsv, municipalitiesCsv)).toEqual({
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

  it("the catalogue is complete and sluggable", () => {
    const { states, municipalities } = buildCatalogue(extract);

    expect(states).toHaveLength(32);
    expect(municipalities).toHaveLength(2478);
    expect(new Set(municipalities.map((m) => m.stateCode)).size).toBe(32);
    expect(municipalities.find((m) => m.code === "13069")).toEqual({
      code: "13069",
      stateCode: "13",
      name: "Tizayuca",
      slug: "tizayuca",
    });
  });

  it("state slugs: the official name, or the common short name of five states", () => {
    const { states } = buildCatalogue(extract);

    expect(Object.fromEntries(states.map((state) => [state.code, state.slug]))).toEqual({
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
    expect(states.find((state) => state.code === "15")?.name).toBe("México");
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
    const message = failure(() =>
      buildCatalogue(extract, { states: STATE_SLUGS, municipalities: {} }),
    );
    expect(message).toContain(
      '"san-juan-mixtepec" for 20208 San Juan Mixtepec, 20209 San Juan Mixtepec',
    );
    expect(message).toContain(
      '"san-pedro-mixtepec" for 20318 San Pedro Mixtepec, 20319 San Pedro Mixtepec',
    );

    const { municipalities } = buildCatalogue(extract);
    const slugs = Object.fromEntries(municipalities.map((m) => [m.code, m.slug]));
    for (const [code, { slug }] of Object.entries(MUNICIPALITY_SLUGS)) {
      expect(slugs[code]).toBe(slug);
    }
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
