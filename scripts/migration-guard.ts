// Migration guard (ADR 0005): migrations are additive only. A destructive
// statement is allowed only in a file that carries an explicit marker comment
// with a reason:
//
//   -- destructive-ok: <reason>
//
// The marker covers the whole file. Destructive changes land one version after
// the code stops using the column or table, and in their own pull request.

export const MARKER = "destructive-ok";

const RULES: readonly { name: string; pattern: RegExp }[] = [
  { name: "DROP", pattern: /\bDROP\b/i },
  { name: "RENAME", pattern: /\bRENAME\b/i },
  { name: "ALTER ... TYPE", pattern: /\bALTER\s+(?:COLUMN\s+)?\w+\s+(?:SET\s+DATA\s+)?TYPE\b/i },
  { name: "SET NOT NULL", pattern: /\bSET\s+NOT\s+NULL\b/i },
  { name: "TRUNCATE", pattern: /\bTRUNCATE\b/i },
];

export type GuardResult =
  | { ok: true; overridden: string | null }
  | { ok: false; statements: string[] };

const markerPattern = new RegExp(`^[ \\t]*--[ \\t]*${MARKER}:[ \\t]*(\\S.*)$`, "im");

/** Removes comments, string literals and quoted identifiers. */
function strip(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, "_q_");
}

export function checkMigration(sql: string): GuardResult {
  const code = strip(sql);
  const statements = RULES.filter((rule) => rule.pattern.test(code)).map((rule) => rule.name);
  if (statements.length === 0) return { ok: true, overridden: null };
  const reason = markerPattern.exec(sql)?.[1]?.trim();
  if (reason) return { ok: true, overridden: reason };
  return { ok: false, statements };
}
