// The brand guard: docs/specs/base-layout.md, requirements "No surface of the
// site names the previous brand or attaches the locality to the name" and
// "Every surface of the site writes the brand as enmirumbo (v2)", and the
// panel messages of docs/specs/admin-review.md ("No panel message is presented
// with the previous brand"). It reads every file under src/, so a page, a
// message or a text added later is checked without touching this file, and it
// fails naming the file and the line. The rules are in test/brand-rules.ts;
// the rendered pages are checked by test/astro/layout.test.ts and
// test/e2e/surfaces.spec.ts.
//
// It never reads docs/: the specifications, the ADRs and the devlogs name the
// earlier spellings on purpose, because they tell what happened when.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { brandFindings } from "../brand-rules.ts";
import { filesUnder, ROOT } from "./source-files.ts";

/** The code of the site's surfaces: pages, components, messages, metadata. */
const GUARDED = ["src"] as const;

/** Every finding under the given folders, as "file:line — what: how to fix it". */
function brandProblems(root: string, folders: readonly string[]): string[] {
  const problems: string[] = [];
  for (const folder of folders) {
    for (const file of filesUnder(join(root, folder))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const finding of brandFindings(line)) {
            problems.push(
              `${relative(root, file)}:${index + 1} — ${finding.what} ("${finding.match}"): ${finding.fix}`,
            );
          }
        });
    }
  }
  return problems;
}

describe("No surface of the site names the previous brand or attaches the locality to the name", () => {
  // Scenarios: a new literal brings the old brand; someone attaches the
  // locality to the brand again.
  it("the code of the site is clean", () => {
    expect(brandProblems(ROOT, GUARDED)).toEqual([]);
  });

  it("it really reads something: the code of the pages and the layout", () => {
    const files = GUARDED.flatMap((folder) => filesUnder(join(ROOT, folder))).map((file) =>
      relative(ROOT, file),
    );
    expect(files).toContain("src/layouts/BaseLayout.astro");
    expect(files).toContain("src/pages/404.astro");
    expect(files.length).toBeGreaterThan(30);
  });

  // Scenario: the repository history stays as it is.
  it("the documentation names the earlier spellings and stays out of the guard", () => {
    expect(brandProblems(ROOT, ["docs"]).length).toBeGreaterThan(0);
    expect(GUARDED).not.toContain("docs");
  });
});

describe("The brand guard fails on what it guards (mutation test)", () => {
  /** A fake source tree with one file. */
  function treeWith(source: string): string {
    const root = mkdtempSync(join(tmpdir(), "brand-guard-"));
    mkdirSync(join(root, "src", "lib"), { recursive: true });
    writeFileSync(join(root, "src", "lib", "texts.ts"), `// A text.\n${source}\n`);
    return root;
  }

  function problemsOf(source: string): string[] {
    const root = treeWith(source);
    try {
      return brandProblems(root, ["src"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const previousBrand = atob("TmVjZXNpdG9Vbm8=");

  // The cases are named, so the test output never spells the previous brand.
  it.for([
    {
      name: "the previous brand",
      source: `export const T = "Hola, te vi en ${previousBrand}.";`,
      what: "the previous brand",
    },
    {
      name: "the previous brand on a domain",
      source: `export const T = "${previousBrand.toLowerCase()}.mx";`,
      what: "the previous brand",
    },
    {
      name: "the camel-case spelling",
      source: 'export const T = "Bienvenido a EnMiRumbo";',
      what: "the brand not in lowercase",
    },
    {
      name: "a capital at the start of a sentence",
      source: 'export const T = "Enmirumbo te ayuda";',
      what: "the brand not in lowercase",
    },
    {
      name: "the three-word spelling",
      source: 'export const T = "Bienvenido a En Mi Rumbo";',
      what: 'the brand in three words ("En Mi Rumbo")',
    },
    {
      name: "the locality written after the brand",
      source: 'export const T = "Hola, te escribo de enmirumbo tizayuca";',
      what: "the locality attached to the brand",
    },
    {
      name: "another place name after the brand",
      source: 'export const T = "Hola desde enmirumbo Pachuca";',
      what: "a proper name attached to the brand",
    },
    {
      name: "the locality record interpolated after the brand",
      source: "export const T = `Hola desde enmirumbo ${locality.name}`;",
      what: "the locality record attached to the brand",
    },
    {
      name: "the locality record after the brand in a template",
      source: "<p>enmirumbo {locality.name}</p>",
      what: "the locality record attached to the brand",
    },
  ])("fails on $name, naming the file and the line", ({ source, what }) => {
    const problems = problemsOf(source);
    expect(problems.length).toBeGreaterThanOrEqual(1);
    expect(problems[0]).toMatch(/^src\/lib\/texts\.ts:2 — /);
    expect(problems.join("\n")).toContain(what);
  });

  it.for([
    'export const T = "enmirumbo, el directorio de negocios de Tizayuca";',
    "export const T = `enmirumbo, el directorio de negocios de ${locality.name}`;",
    'export const T = "Hola, te vi en enmirumbo. ¿Me das informes?";',
    'export const URL = "https://enmirumbo.com";',
    'export const NAME = "enmirumbo-local";',
    'export const T = "necesito uno";',
  ])("passes on %s", (source) => {
    expect(problemsOf(source)).toEqual([]);
  });
});
