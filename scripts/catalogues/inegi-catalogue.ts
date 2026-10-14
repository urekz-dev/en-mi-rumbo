// INEGI's catalogue of states and municipalities as reference data (ADR 0006,
// docs/specs/data-model.md). inegi.ts turns INEGI's complete catalogues (CSV)
// into the data migration drizzle/0003_inegi_catalogue.sql, with the slug of
// every state and municipality and Tizayuca's locality. The CSV files are not
// kept: the migration holds the data, and test/worker/locality.test.ts checks
// what it leaves in the database.
import { SLUG_PATTERN } from "../../src/core/db/schema/checks.ts";

export interface Entry {
  code: string;
  name: string;
}

/** The codes and official names of INEGI's catalogues. */
export interface Entries {
  states: Entry[];
  municipalities: Entry[];
}

export interface Catalogue {
  states: (Entry & { slug: string })[];
  municipalities: (Entry & { stateCode: string; slug: string })[];
}

/** Slugs chosen by hand, each valid while INEGI keeps the official name. */
export type SlugOverrides = Readonly<Record<string, { name: string; slug: string }>>;

/** States whose URLs use the common short name instead of the official one. */
export const STATE_SLUGS: SlugOverrides = {
  "05": { name: "Coahuila de Zaragoza", slug: "coahuila" },
  "09": { name: "Ciudad de México", slug: "ciudad-de-mexico" },
  "15": { name: "México", slug: "estado-de-mexico" },
  "16": { name: "Michoacán de Ocampo", slug: "michoacan" },
  "30": { name: "Veracruz de Ignacio de la Llave", slug: "veracruz" },
};

/**
 * Municipalities whose official name repeats within their state. INEGI tells
 * them apart by the district in the name of their seat ("San Juan Mixtepec
 * Distrito 08"), and so do their slugs. Any other collision stops the script.
 */
export const MUNICIPALITY_SLUGS: SlugOverrides = {
  "20208": { name: "San Juan Mixtepec", slug: "san-juan-mixtepec-distrito-08" },
  "20209": { name: "San Juan Mixtepec", slug: "san-juan-mixtepec-distrito-26" },
  "20318": { name: "San Pedro Mixtepec", slug: "san-pedro-mixtepec-distrito-22" },
  "20319": { name: "San Pedro Mixtepec", slug: "san-pedro-mixtepec-distrito-26" },
};

/**
 * The localities the migration creates: Tizayuca, inactive and without a
 * contact WhatsApp until a super admin sets both (ADR 0021).
 */
export const LOCALITIES: readonly { code: string; timeZone: string }[] = [
  { code: "13069", timeZone: "America/Mexico_City" },
];

const SLUG = new RegExp(SLUG_PATTERN);

/**
 * The slug of an official name: lowercase ASCII words joined by hyphens, with
 * the accents removed (ñ becomes n) and the punctuation dropped. Throws on a
 * letter it cannot write in ASCII instead of losing it.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\p{Pd}/gu, " ")
    .replace(/[\p{P}\p{S}]/gu, "")
    .trim()
    .split(/\s+/)
    .join("-");
  if (!SLUG.test(slug)) throw new Error(`no slug for "${name}" (got "${slug}")`);
  return slug;
}

const byCode = (a: Entry, b: Entry) => a.code.localeCompare(b.code);

/**
 * The catalogue with its slugs. Every problem is reported at once: a malformed
 * or repeated code, a municipality without its state, a slug chosen for a
 * name INEGI no longer uses, and two states, or two municipalities of one
 * state, with the same slug. A collision is never resolved with a suffix: a
 * person chooses the slugs in MUNICIPALITY_SLUGS.
 */
export function buildCatalogue(
  entries: Entries,
  overrides: { states: SlugOverrides; municipalities: SlugOverrides } = {
    states: STATE_SLUGS,
    municipalities: MUNICIPALITY_SLUGS,
  },
): Catalogue {
  const problems: string[] = [];

  const checkCodes = (label: string, entries: Entry[], pattern: RegExp, chosen: SlugOverrides) => {
    const seen = new Set<string>();
    for (const { code, name } of entries) {
      if (!pattern.test(code)) problems.push(`${label} "${code}": malformed code`);
      if (seen.has(code)) problems.push(`${label} ${code}: repeated code`);
      if (name.trim() === "") problems.push(`${label} ${code}: empty name`);
      seen.add(code);
    }
    for (const code of Object.keys(chosen)) {
      if (!seen.has(code)) problems.push(`${label} ${code}: has a slug chosen but is missing`);
    }
  };
  checkCodes("state", entries.states, /^[0-9]{2}$/, overrides.states);
  checkCodes("municipality", entries.municipalities, /^[0-9]{5}$/, overrides.municipalities);

  const slugOf = (entry: Entry, chosen: SlugOverrides): string => {
    const override = chosen[entry.code];
    if (override && override.name !== entry.name) {
      problems.push(
        `${entry.code}: the slug "${override.slug}" was chosen for "${override.name}", ` +
          `but INEGI's name is now "${entry.name}"`,
      );
    }
    try {
      return override?.slug ?? slugify(entry.name);
    } catch (error) {
      problems.push(`${entry.code}: ${(error as Error).message}`);
      return "";
    }
  };
  const states = entries.states
    .toSorted(byCode)
    .map((entry) => ({ ...entry, slug: slugOf(entry, overrides.states) }));
  const stateNames = new Map(states.map((state) => [state.code, state.name]));
  const municipalities = entries.municipalities.toSorted(byCode).map((entry) => {
    const stateCode = entry.code.slice(0, 2);
    if (!stateNames.has(stateCode)) {
      problems.push(`municipality ${entry.code}: its state ${stateCode} is missing`);
    }
    return { ...entry, stateCode, slug: slugOf(entry, overrides.municipalities) };
  });

  // Slugs are unique among the states, and among the municipalities of a state.
  const groups = new Map<string, { scope: string; slug: string; entries: Entry[] }>();
  const add = (scopeKey: string, scope: string, slug: string, entry: Entry) => {
    const key = `${scopeKey}/${slug}`;
    const group = groups.get(key) ?? { scope, slug, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  };
  for (const state of states) add("", "the states", state.slug, state);
  for (const municipality of municipalities) {
    const { stateCode, slug } = municipality;
    const scope = `the municipalities of ${stateNames.get(stateCode) ?? stateCode}`;
    add(stateCode, scope, slug, municipality);
  }
  for (const { scope, slug, entries } of groups.values()) {
    if (entries.length > 1) {
      const list = entries.map(({ code, name }) => `${code} ${name}`).join(", ");
      problems.push(`slug collision among ${scope}: "${slug}" for ${list}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`INEGI catalogue: ${problems.length} problem(s)\n- ${problems.join("\n- ")}`);
  }
  return { states, municipalities };
}

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * The data migration, drizzle/0003_inegi_catalogue.sql. `attribution` is the
 * credit INEGI asks for, with the "fecha de corte" of the catalogue.
 */
export function catalogueSql(entries: Entries, attribution: string): string {
  const { states, municipalities } = buildCatalogue(entries);
  for (const { code } of LOCALITIES) {
    if (!municipalities.some((municipality) => municipality.code === code)) {
      throw new Error(`INEGI catalogue: the locality ${code} is not a municipality`);
    }
  }
  const values = (rows: string[][]) => `${rows.map((row) => `  (${row.join(", ")})`).join(",\n")};`;
  return [
    "-- Custom migration (ADR 0006): INEGI's catalogue of states and municipalities",
    "-- as reference data, with the slugs of the public URLs, and Tizayuca's locality.",
    "-- Generated by `vp run db:inegi` from INEGI's CSV files (README, INEGI",
    "-- catalogue); never edit it by hand. The codes and names are INEGI's; the slugs",
    "-- are not.",
    `-- ${attribution}`,
    "-- Tizayuca starts inactive and without a contact WhatsApp: a super admin sets",
    "-- both in the database (README, Panel users and roles).",
    'INSERT INTO "states" ("code", "name", "slug") VALUES',
    values(states.map((s) => [s.code, s.name, s.slug].map(literal))),
    "--> statement-breakpoint",
    'INSERT INTO "municipalities" ("code", "state_code", "name", "slug") VALUES',
    values(municipalities.map((m) => [m.code, m.stateCode, m.name, m.slug].map(literal))),
    "--> statement-breakpoint",
    'INSERT INTO "localities" ("code", "time_zone", "active") VALUES',
    values(LOCALITIES.map((l) => [literal(l.code), literal(l.timeZone), "false"])),
    "",
  ].join("\n");
}

/** The rows of a CSV file (RFC 4180) as objects keyed by its header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      rows.push([...row, field]);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) rows.push([...row, field]);
  const [header = [], ...body] = rows.filter((values) => values.some((value) => value !== ""));
  return body.map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])));
}

/**
 * The codes and names of INEGI's complete catalogues: the UTF-8 CSV files of
 * catun_entidad.zip (CVE_ENT, NOM_ENT) and catun_municipio.zip (CVEGEO,
 * NOM_MUN). Names are kept exactly as INEGI writes them.
 */
export function entriesFromCsv(statesCsv: string, municipalitiesCsv: string): Entries {
  const pick = (csv: string, codeColumn: string, nameColumn: string): Entry[] =>
    parseCsv(csv)
      .map((row) => {
        const code = row[codeColumn];
        const name = row[nameColumn];
        if (code === undefined || name === undefined) {
          throw new Error(`INEGI catalogue: no ${codeColumn} or ${nameColumn} column`);
        }
        return { code, name };
      })
      .toSorted(byCode);
  return {
    states: pick(statesCsv, "CVE_ENT", "NOM_ENT"),
    municipalities: pick(municipalitiesCsv, "CVEGEO", "NOM_MUN"),
  };
}
