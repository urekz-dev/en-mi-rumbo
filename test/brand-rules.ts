// The brand rules of docs/specs/base-layout.md, requirements "No surface of the
// site names the previous brand or attaches the locality to the name" and
// "Every surface of the site writes the brand as enmirumbo (v2)". Shared by the
// guard of the code (test/scripts/brand-guard.test.ts) and the checks of the
// rendered pages (test/astro/layout.test.ts, test/e2e/surfaces.spec.ts).

export interface BrandFinding {
  what: string;
  match: string;
  fix: string;
}

interface BrandRule {
  what: string;
  pattern: RegExp;
  fix: string;
  /** A match this returns true for is not a finding. */
  allowed?: (match: string) => boolean;
}

// Like the specifications, the repository never spells the previous brand in
// clear, so its pattern is kept in base64.
const PREVIOUS_BRAND = atob("bmVjZXNpdG91bm8=");

const AS_DESCRIPTOR =
  'the locality goes as a descriptor ("enmirumbo, el directorio de negocios de …"), never attached to the name';

const RULES: readonly BrandRule[] = [
  {
    what: "the previous brand",
    pattern: new RegExp(PREVIOUS_BRAND, "giu"),
    fix: 'the brand is "enmirumbo"',
  },
  {
    what: "the brand not in lowercase",
    pattern: /enmirumbo/giu,
    allowed: (match) => match === "enmirumbo",
    fix: '"enmirumbo" is one word, always lowercase, also at the start of a sentence',
  },
  {
    what: 'the brand in three words ("En Mi Rumbo")',
    pattern: /\ben[\s_-]+mi[\s_-]+rumbo\b/giu,
    fix: '"enmirumbo" is one word, always lowercase',
  },
  {
    what: "the locality attached to the brand",
    pattern: /enmirumbo[ \t\u00a0]+tizayuca/giu,
    fix: AS_DESCRIPTOR,
  },
  {
    // Case-sensitive on purpose: with the i flag, \p{Lu} matches any letter.
    what: "a proper name attached to the brand",
    pattern: /enmirumbo[ \t\u00a0]+\p{Lu}/gu,
    fix: AS_DESCRIPTOR,
  },
  {
    what: "the locality record attached to the brand",
    pattern: /enmirumbo[ \t\u00a0]*\$?\{[^}]*\b(?:locality|municipality|state)\b/giu,
    fix: AS_DESCRIPTOR,
  },
];

/** What a text says against the brand rules. */
export function brandFindings(text: string): BrandFinding[] {
  const findings: BrandFinding[] = [];
  for (const rule of RULES) {
    for (const [match] of text.matchAll(rule.pattern)) {
      if (rule.allowed?.(match) === true) continue;
      findings.push({ what: rule.what, match, fix: rule.fix });
    }
  }
  return findings;
}

/**
 * The locality names (a municipality, a state) that a rendered text attaches
 * to the brand on the same line, as in "enmirumbo <name>" or "enmirumbo<name>".
 */
export function attachedLocalityNames(text: string, names: readonly string[]): string[] {
  return names.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`enmirumbo[ \\t\\u00a0]*${escaped}`, "iu").test(text);
  });
}
