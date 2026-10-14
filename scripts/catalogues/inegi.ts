// `vp run db:inegi <states.csv> <municipalities.csv> <YYYY-MM> <migration.sql>`:
// writes INEGI's catalogue of states and municipalities as a data migration
// (inegi-catalogue.ts), from the UTF-8 CSV files inside INEGI's
// catun_entidad.zip and catun_municipio.zip. <YYYY-MM> is the "fecha de corte"
// INEGI shows for them. It fails, listing every problem, when two
// municipalities of a state would share a slug. See README, INEGI catalogue.
//
// drizzle/0003_inegi_catalogue.sql was written this way. Applied migrations
// never change: a newer INEGI catalogue ships in a new migration.
import { readFileSync, writeFileSync } from "node:fs";
import { catalogueSql, entriesFromCsv } from "./inegi-catalogue.ts";

const TITLE =
  "Catálogo Único de Claves de Áreas Geoestadísticas Estatales, Municipales y Localidades";

const [statesPath, municipalitiesPath, cutoff, output] = process.argv.slice(2);
if (
  !statesPath ||
  !municipalitiesPath ||
  !cutoff ||
  !/^[0-9]{4}-[0-9]{2}$/.test(cutoff) ||
  !output
) {
  console.error(
    "usage: vp run db:inegi <states.csv> <municipalities.csv> <YYYY-MM> <migration.sql>",
  );
  process.exit(1);
}

const entries = entriesFromCsv(
  readFileSync(statesPath, "utf8"),
  readFileSync(municipalitiesPath, "utf8"),
);
let sql: string;
try {
  sql = catalogueSql(entries, `Fuente: INEGI, ${TITLE}, fecha de corte ${cutoff}.`);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
writeFileSync(output, sql);
console.log(
  `db:inegi: ${output} written with ${entries.states.length} states and ` +
    `${entries.municipalities.length} municipalities.`,
);
