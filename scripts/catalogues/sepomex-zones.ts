// SEPOMEX's settlements as the zones of a locality (ADR 0006,
// docs/specs/data-model.md). sepomex.ts turns the TXT file of the Catálogo
// Nacional de Códigos Postales of Correos de México into a data migration,
// such as drizzle/0006_tizayuca_zones.sql, with the type, name and slug of
// every settlement of one municipality. The file is not kept: the migration
// holds the data, and test/worker/zones.test.ts checks what it leaves in the
// database.
import { isSlug, slugify } from "./slug.ts";

/** One row of SEPOMEX's catalogue: a settlement (asentamiento). */
export interface Settlement {
  /** The INEGI code of its municipality: c_estado followed by c_mnpio. */
  municipalityCode: string;
  /** D_mnpio and d_estado, the names of its municipality and state. */
  municipality: string;
  state: string;
  /** d_codigo. Only to name the settlement in messages: it is not stored. */
  postalCode: string;
  /** d_asenta and d_tipo_asenta. */
  name: string;
  type: string;
}

export interface Zone {
  type: string;
  name: string;
  slug: string;
}

/** A slug chosen by hand, valid while SEPOMEX keeps the name and type. */
export interface ChosenSlug {
  name: string;
  type: string;
  slug: string;
}

/**
 * Slugs chosen by hand, by INEGI municipality code. SEPOMEX lists some names
 * twice with two settlement types; each keeps its name, and the slug carries
 * its type. Any other repeated name, or slug, stops the script.
 */
export const ZONE_SLUGS: Readonly<Record<string, readonly ChosenSlug[]>> = {
  "13069": [
    // Both in postal code 43815.
    { name: "El Carmen", type: "Colonia", slug: "colonia-el-carmen" },
    { name: "El Carmen", type: "Fraccionamiento", slug: "fraccionamiento-el-carmen" },
    // 43824 and 43817.
    { name: "El Chopo", type: "Pueblo", slug: "pueblo-el-chopo" },
    { name: "El Chopo", type: "Rancho", slug: "rancho-el-chopo" },
    // Both in 43824.
    { name: "El Manantial", type: "Fraccionamiento", slug: "fraccionamiento-el-manantial" },
    { name: "El Manantial", type: "Rancho", slug: "rancho-el-manantial" },
    // 43806 and 43804.
    { name: "Tizayuca", type: "Unidad habitacional", slug: "unidad-habitacional-tizayuca" },
    { name: "Tizayuca", type: "Zona industrial", slug: "zona-industrial-tizayuca" },
  ],
};

/** The zones of a municipality, and what the cleanup did to get them. */
export interface Zones {
  municipality: string;
  state: string;
  /** How many settlements SEPOMEX lists for the municipality. */
  settlements: number;
  /** Sorted by slug. */
  zones: Zone[];
  /** One line per change, for the person who runs the script. */
  merges: string[];
  fixes: string[];
  chosen: string[];
}

/**
 * The text of SEPOMEX's TXT file. Correos de México publishes it in
 * ISO-8859-1 (read as Windows-1252, its superset); a file already converted
 * to UTF-8 is read as it is.
 */
export function decodeSepomex(bytes: Uint8Array): { text: string; encoding: string } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "Windows-1252" };
  }
}

/**
 * The settlements of SEPOMEX's TXT file: a notice line, a header line, and
 * one line per settlement with its fields separated by "|".
 */
export function parseSepomex(text: string): Settlement[] {
  const lines = text.split(/\r?\n/);
  const headerAt = lines.findIndex((line) => line.startsWith("d_codigo|"));
  if (headerAt < 0) throw new Error("SEPOMEX catalogue: no header line (d_codigo|d_asenta|…)");
  const header = (lines[headerAt] ?? "").split("|");
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`SEPOMEX catalogue: no ${name} column`);
    return index;
  };
  const at = {
    postalCode: column("d_codigo"),
    name: column("d_asenta"),
    type: column("d_tipo_asenta"),
    municipality: column("D_mnpio"),
    state: column("d_estado"),
    stateCode: column("c_estado"),
    municipalityCode: column("c_mnpio"),
  };
  return lines
    .slice(headerAt + 1)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const fields = line.split("|");
      const field = (index: number) => fields[index] ?? "";
      return {
        municipalityCode: field(at.stateCode) + field(at.municipalityCode),
        municipality: field(at.municipality),
        state: field(at.state),
        postalCode: field(at.postalCode),
        name: field(at.name),
        type: field(at.type),
      };
    });
}

// Each byte as Windows-1252 decodes it, to undo a second decoding.
const WINDOWS_1252 = new TextDecoder("windows-1252");
const BYTE_OF = new Map(
  Array.from({ length: 256 }, (_, byte) => [WINDOWS_1252.decode(Uint8Array.of(byte)), byte]),
);

/** "PurÃ­sima": UTF-8 decoded a second time, as Windows-1252. */
function decodedTwice(text: string): boolean {
  const chars = Array.from(text);
  return chars.some((char, i) => {
    const next = BYTE_OF.get(chars[i + 1] ?? "");
    return (char === "Ã" || char === "Â") && next !== undefined && next >= 0x80 && next < 0xc0;
  });
}

/**
 * A name or type as SEPOMEX writes it, with its spaces trimmed and collapsed.
 * Text that was decoded twice ("PurÃ­sima") is decoded back once and marked
 * as fixed. A letter lost to the encoding ("Pur�sima") cannot be fixed, so
 * it throws.
 */
export function cleanName(raw: string): { name: string; fixed: boolean } {
  const name = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (decodedTwice(name)) {
    const bytes = Array.from(name, (char) => BYTE_OF.get(char));
    if (bytes.every((byte) => byte !== undefined)) {
      try {
        const fixed = new TextDecoder("utf-8", { fatal: true })
          .decode(Uint8Array.from(bytes))
          .normalize("NFC");
        return { name: fixed, fixed: true };
      } catch {
        // Not UTF-8 after all: checked below.
      }
    }
    throw new Error(`"${name}" looks garbled by the encoding`);
  }
  if (name.includes("�")) throw new Error(`"${name}" lost a letter to the encoding`);
  return { name, fixed: false };
}

/** Two names are the same when they differ only in case, accents or spacing. */
export function nameKey(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
}

interface Row {
  postalCode: string;
  name: string;
  type: string;
  order: number;
}

/**
 * The best-written of several spellings of one name: the one with the most
 * accents, then one that is neither all capitals nor all lowercase, then the
 * most frequent, then the first in the file.
 */
function bestSpelling(rows: readonly Row[]): string {
  const accents = (name: string) => name.normalize("NFD").match(/\p{M}/gu)?.length ?? 0;
  const mixedCase = (name: string) =>
    name !== name.toUpperCase() && name !== name.toLowerCase() ? 1 : 0;
  const frequency = (name: string) => rows.filter((row) => row.name === name).length;
  const first = (name: string) => rows.find((row) => row.name === name)?.order ?? 0;
  const [best] = [...new Set(rows.map((row) => row.name))].toSorted(
    (a, b) =>
      accents(b) - accents(a) ||
      mixedCase(b) - mixedCase(a) ||
      frequency(b) - frequency(a) ||
      first(a) - first(b),
  );
  return best ?? "";
}

const postalCodes = (rows: readonly Row[]) => [...new Set(rows.map((row) => row.postalCode))];

/**
 * The zones of the municipality `code`. Names are cleaned (cleanName); the
 * settlements whose names differ only in case, accents or spacing become one
 * zone with the best-written spelling. Every problem is reported at once: a
 * name SEPOMEX lists with two settlement types that has no slugs chosen in
 * `chosen`, a slug chosen for a settlement SEPOMEX no longer lists, a name
 * without a slug, and two zones with the same slug. A collision is never
 * resolved with a suffix: a person chooses the slugs in ZONE_SLUGS.
 */
export function buildZones(
  settlements: readonly Settlement[],
  code: string,
  chosen: readonly ChosenSlug[] = ZONE_SLUGS[code] ?? [],
): Zones {
  const own = settlements.filter((settlement) => settlement.municipalityCode === code);
  const [first] = own;
  if (!/^[0-9]{5}$/.test(code) || first === undefined) {
    throw new Error(`SEPOMEX zones: the catalogue has no settlement of municipality "${code}"`);
  }
  const problems: string[] = [];
  const fixes: string[] = [];
  const merges: string[] = [];
  const chosenLines: string[] = [];

  // Names and types as SEPOMEX writes them, without stray spaces.
  const rows: Row[] = [];
  own.forEach(({ postalCode, name: rawName, type: rawType }, order) => {
    try {
      const name = cleanName(rawName);
      const type = cleanName(rawType);
      if (name.fixed) fixes.push(`${postalCode}: "${rawName}" is "${name.name}"`);
      if (type.fixed) fixes.push(`${postalCode}: "${rawType}" is "${type.name}"`);
      if (name.name === "" || type.name === "") {
        problems.push(`${postalCode}: a settlement without a name or type`);
      } else rows.push({ postalCode, name: name.name, type: type.name, order });
    } catch (error) {
      problems.push(`${postalCode}: ${(error as Error).message}`);
    }
  });

  // One zone per name and type; a name with two types needs chosen slugs.
  const groups = new Map<string, Map<string, Row[]>>();
  for (const row of rows) {
    const byType = groups.get(nameKey(row.name)) ?? new Map<string, Row[]>();
    byType.set(row.type, [...(byType.get(row.type) ?? []), row]);
    groups.set(nameKey(row.name), byType);
  }
  const used = new Set<ChosenSlug>();
  const zones: (Zone & { rows: Row[] })[] = [];
  for (const byType of groups.values()) {
    const candidates = [...byType].map(([type, typeRows]) => {
      const name = bestSpelling(typeRows);
      const others = [...new Set(typeRows.map((row) => row.name))].filter((n) => n !== name);
      if (others.length > 0) {
        const merged = others.map((other) => {
          const codes = postalCodes(typeRows.filter((row) => row.name === other));
          return `"${other}" (${codes.join(", ")})`;
        });
        merges.push(`"${name}" (${type}) also as ${merged.join(", ")}`);
      }
      const pick = chosen.find((c) => c.name === name && c.type === type);
      if (pick) used.add(pick);
      return { type, name, rows: typeRows, pick };
    });
    if (candidates.length > 1) {
      const list = candidates.map(
        ({ name, type, rows: r }) => `"${name}" (${type}, ${postalCodes(r).join(", ")})`,
      );
      if (candidates.some(({ pick }) => pick === undefined)) {
        problems.push(
          `one name with ${candidates.length} settlement types: ${list.join(", ")}; ` +
            "choose a slug for each in ZONE_SLUGS",
        );
        continue;
      }
      chosenLines.push(
        candidates
          .map(({ name, type, pick }) => `"${name}" (${type}) is ${pick?.slug ?? ""}`)
          .join(", "),
      );
    }
    for (const { type, name, rows: zoneRows, pick } of candidates) {
      try {
        zones.push({ type, name, slug: pick?.slug ?? slugify(name), rows: zoneRows });
      } catch (error) {
        problems.push(`${postalCodes(zoneRows).join(", ")}: ${(error as Error).message}`);
      }
    }
  }
  for (const c of chosen) {
    if (!isSlug(c.slug)) problems.push(`"${c.name}" (${c.type}): "${c.slug}" is not a slug`);
    if (!used.has(c)) {
      problems.push(
        `a slug was chosen for "${c.name}" (${c.type}), ` +
          `which SEPOMEX does not list in ${code} under that name and type`,
      );
    }
  }

  // Slugs are unique within the locality.
  const bySlug = Map.groupBy(zones, (zone) => zone.slug);
  for (const [slug, same] of bySlug) {
    if (same.length > 1) {
      const list = same.map(
        ({ name, type, rows: r }) => `"${name}" (${type}, ${postalCodes(r).join(", ")})`,
      );
      problems.push(`slug collision: "${slug}" for ${list.join(", ")}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `SEPOMEX zones of ${code}: ${problems.length} problem(s)\n- ${problems.join("\n- ")}`,
    );
  }
  return {
    municipality: first.municipality,
    state: first.state,
    settlements: own.length,
    zones: zones
      .map(({ type, name, slug }) => ({ type, name, slug }))
      .toSorted((a, b) => (a.slug < b.slug ? -1 : 1)),
    merges,
    fixes,
    chosen: chosenLines,
  };
}

/** Where the catalogue comes from, for the credit of the migration. */
export const SOURCE = {
  publisher: "Servicio Postal Mexicano (Correos de México)",
  title: "Catálogo Nacional de Códigos Postales",
  url: "https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx",
} as const;

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * The data migration of the zones of the locality `code`. `updated` is the
 * date of the catalogue's last update (YYYY-MM-DD), shown on its download
 * page.
 */
export function zonesSql(built: Zones, code: string, updated: string): string {
  const rows = built.zones.map(({ type, name, slug }) =>
    [code, type, name, slug].map(literal).join(", "),
  );
  return [
    `-- Custom migration (ADR 0006): the zones of ${built.municipality}, ${built.state} (locality ${code}),`,
    "-- one per settlement of SEPOMEX's postal catalogue, with its settlement type and",
    "-- the slug of the public URLs. Generated by `vp run db:zones` from the catalogue's",
    "-- TXT file (README, SEPOMEX zones); never edit it by hand. The names and types are",
    "-- SEPOMEX's; the slugs are not. Postal codes are not stored.",
    `-- Fuente: ${SOURCE.publisher}, ${SOURCE.title}, última actualización ${updated}.`,
    `-- ${SOURCE.url}`,
    'INSERT INTO "zones" ("locality_code", "type", "name", "slug") VALUES',
    `${rows.map((row) => `  (${row})`).join(",\n")};`,
    "",
  ].join("\n");
}
