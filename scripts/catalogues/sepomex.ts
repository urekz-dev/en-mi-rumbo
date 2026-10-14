// `vp run db:zones <sepomex.txt> <municipality code> <YYYY-MM-DD> <migration.sql>`:
// writes the zones of one locality as a data migration (sepomex-zones.ts),
// from the TXT file of SEPOMEX's Catálogo Nacional de Códigos Postales, of
// one state or of the whole country. <municipality code> is the INEGI code of
// the locality (13069 for Tizayuca); <YYYY-MM-DD> is the date of the
// catalogue's last update, shown on its download page. It prints what the
// cleanup merged, fixed and took from ZONE_SLUGS, and fails, listing every
// problem, on a name with two settlement types without chosen slugs and on a
// slug collision. See README, SEPOMEX zones.
//
// drizzle/0006_tizayuca_zones.sql was written this way. Applied migrations
// never change: zones that SEPOMEX adds later ship in a new migration.
import { readFileSync, writeFileSync } from "node:fs";
import { buildZones, decodeSepomex, parseSepomex, type Zones, zonesSql } from "./sepomex-zones.ts";

const [path, code, updated, output] = process.argv.slice(2);
if (
  !path ||
  !code ||
  !/^[0-9]{5}$/.test(code) ||
  !updated ||
  !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(updated) ||
  !output
) {
  console.error(
    "usage: vp run db:zones <sepomex.txt> <municipality code> <YYYY-MM-DD> <migration.sql>",
  );
  process.exit(1);
}

const { text, encoding } = decodeSepomex(readFileSync(path));
let built: Zones;
try {
  built = buildZones(parseSepomex(text), code);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
writeFileSync(output, zonesSql(built, code, updated));

const types = [...Map.groupBy(built.zones, (zone) => zone.type)].toSorted(
  ([a, x], [b, y]) => y.length - x.length || a.localeCompare(b, "es"),
);
const changes: [string, string[]][] = [
  ["Merged", built.merges],
  ["Encoding fixed", built.fixes],
  ["Slugs chosen in ZONE_SLUGS", built.chosen],
];
const lines = [
  `db:zones: ${output} written with ${built.zones.length} zones of ${built.municipality}, ` +
    `${built.state}, from ${built.settlements} settlements (file read as ${encoding}).`,
  `Types: ${types.map(([type, zones]) => `${type} ${zones.length}`).join(", ")}.`,
  ...changes.map(
    ([label, list]) => `${label}: ${list.length === 0 ? "none" : `\n- ${list.join("\n- ")}`}`,
  ),
];
console.log(lines.join("\n"));
