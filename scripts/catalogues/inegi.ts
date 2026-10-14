// `vp run db:inegi`: writes the data migration drizzle/0003_inegi_catalogue.sql
// from the extract scripts/catalogues/inegi.json (inegi-catalogue.ts). It
// fails, listing every problem, when two municipalities of a state would share
// a slug. Applied migrations never change: a newer INEGI catalogue ships in a
// new migration, never by regenerating this one.
//
// `vp run db:inegi extract <states.csv> <municipalities.csv> <cutoff>` rewrites
// the extract from the UTF-8 CSV files inside INEGI's catun_entidad.zip and
// catun_municipio.zip. <cutoff> is the "fecha de corte" INEGI shows for them,
// as YYYY-MM. See README, Database.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  catalogueSql,
  type Extract,
  extractEntries,
  extractJson,
  MUNICIPALITY_SLUGS,
  STATE_SLUGS,
} from "./inegi-catalogue.ts";

const EXTRACT = new URL("inegi.json", import.meta.url);
const MIGRATION = new URL("../../drizzle/0003_inegi_catalogue.sql", import.meta.url);

const TITLE =
  "Catálogo Único de Claves de Áreas Geoestadísticas Estatales, Municipales y Localidades";
const DOWNLOADS = "https://www.inegi.org.mx/contenidos/app/ageeml";

const [command, ...args] = process.argv.slice(2);

if (command === "extract") {
  const [statesPath, municipalitiesPath, cutoff] = args;
  if (!statesPath || !municipalitiesPath || !cutoff || !/^[0-9]{4}-[0-9]{2}$/.test(cutoff)) {
    console.error("usage: vp run db:inegi extract <states.csv> <municipalities.csv> <YYYY-MM>");
    process.exit(1);
  }
  const statesCsv = readFileSync(statesPath);
  const municipalitiesCsv = readFileSync(municipalitiesPath);
  const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
  const extract: Extract = {
    source: {
      title: TITLE,
      publisher: "Instituto Nacional de Estadística y Geografía (INEGI)",
      page: "https://www.inegi.org.mx/app/ageeml/",
      terms: "https://www.inegi.org.mx/inegi/terminos.html",
      attribution: `Fuente: INEGI, ${TITLE}, fecha de corte ${cutoff}.`,
      cutoff,
      downloaded: new Date().toISOString().slice(0, 10),
      files: [
        {
          url: `${DOWNLOADS}/catun_entidad.zip`,
          file: basename(statesPath),
          sha256: sha256(statesCsv),
        },
        {
          url: `${DOWNLOADS}/catun_municipio.zip`,
          file: basename(municipalitiesPath),
          sha256: sha256(municipalitiesCsv),
        },
      ],
      note:
        "Only the codes and the official names are kept. The slugs are not INEGI's: " +
        "scripts/catalogues/inegi-catalogue.ts computes them.",
    },
    ...extractEntries(statesCsv.toString("utf8"), municipalitiesCsv.toString("utf8")),
  };
  writeFileSync(EXTRACT, extractJson(extract));
  console.log(
    `db:inegi: extract written with ${extract.states.length} states and ` +
      `${extract.municipalities.length} municipalities.`,
  );
} else if (command === undefined) {
  const extract = JSON.parse(readFileSync(EXTRACT, "utf8")) as Extract;
  let sql: string;
  try {
    sql = catalogueSql(extract);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  writeFileSync(MIGRATION, sql);
  console.log(
    `db:inegi: drizzle/0003_inegi_catalogue.sql written with ${extract.states.length} states ` +
      `and ${extract.municipalities.length} municipalities; slugs chosen by hand for ` +
      `${Object.keys(STATE_SLUGS).length} states and ` +
      `${Object.keys(MUNICIPALITY_SLUGS).length} municipalities.`,
  );
} else {
  console.error(`db:inegi: unknown command "${command}"`);
  process.exit(1);
}
