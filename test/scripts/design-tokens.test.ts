// Scenarios of docs/specs/base-layout.md, requirements "Palette and typography
// as reusable tokens with WhatsApp green as the primary action", "Base
// accessibility from PRD §8" (contrast of the tokens, outline of controls,
// touch areas) and "Mobile-first design with no horizontal scroll" (no class
// that blocks the collapse, in the code of the components). The served HTML is
// checked by test/e2e/surfaces.spec.ts.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { collapseProblems } from "../responsive-rules.ts";
import { filesUnder, ROOT } from "./source-files.ts";

const CSS_FILE = "src/styles/global.css";
const css = readFileSync(join(ROOT, CSS_FILE), "utf8");
const theme = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const tokens = new Map(
  [...theme.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, hex]) => [
    name ?? "",
    hex ?? "",
  ]),
);

function token(name: string): string {
  const hex = tokens.get(name);
  if (hex === undefined) throw new Error(`no colour token --color-${name} in ${CSS_FILE}`);
  return hex;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Relative luminance, WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio, WCAG 2.1. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const sources = filesUnder(join(ROOT, "src")).filter((file) => /\.(astro|ts|css)$/.test(file));
const components = sources.filter((file) => file.endsWith(".astro"));

/** The literal class attributes of an .astro file. */
function classAttributesOf(source: string): string[] {
  return [...source.matchAll(/\bclass="([^"]*)"/g)].map(([, list]) => list ?? "");
}

describe("Palette and typography as reusable tokens with WhatsApp green as the primary action", () => {
  // Scenario: the action green is tokenized and documented
  it("WhatsApp green is a token documented as the primary action colour", () => {
    expect(token("action")).toBe("#25d366");
    const comment = theme.slice(0, theme.indexOf("--color-action:"));
    expect(comment).toMatch(/THE PRIMARY ACTION COLOUR/);
  });

  it("no other token competes with it: every other colour is a neutral but its accessible variant", () => {
    for (const [name, hex] of tokens) {
      if (name === "action" || name === "action-strong") continue;
      const [r, g, b] = channels(hex);
      expect(Math.max(r, g, b) - Math.min(r, g, b), `--color-${name} ${hex}`).toBeLessThanOrEqual(
        12,
      );
    }
  });

  it("the typography is a token: the system font stack, with no font to download", () => {
    expect(theme).toMatch(/--font-sans:\s*system-ui,/);
    expect(css).not.toMatch(/@font-face|fonts\.googleapis|url\(/);
  });

  // Scenario: the layout consumes only tokens
  it("Tailwind's default palette is removed, so only tokens are colours", () => {
    expect(theme).toMatch(/--color-\*:\s*initial;/);
  });

  it("no source file outside the tokens writes a loose colour or font", () => {
    const problems = sources
      .filter((file) => !file.endsWith(CSS_FILE))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return [
          /#[0-9a-f]{3,8}\b/gi,
          /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi,
          /\bfont-family\b/gi,
          /\b(?:bg|text|border|ring|outline|fill|stroke|decoration|divide|placeholder|accent|caret|shadow|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/g,
          /\b[a-z-]+-\[(?:#|rgb|hsl|color:)/g,
        ].flatMap((pattern) =>
          [...source.matchAll(pattern)].map(([match]) => `${relative(ROOT, file)}: ${match}`),
        );
      });
    expect(problems).toEqual([]);
  });

  it("the layout, the header and the footer are navigation: they never use the action green", () => {
    for (const file of [
      "src/layouts/BaseLayout.astro",
      "src/components/SiteHeader.astro",
      "src/components/SiteFooter.astro",
    ]) {
      expect(classAttributesOf(readFileSync(join(ROOT, file), "utf8")).join(" "), file).not.toMatch(
        /-action\b|-action-/,
      );
    }
  });
});

describe("Base accessibility from PRD §8", () => {
  // Scenario: AA contrast of the tokens
  it.for([
    ["ink", "background"],
    ["ink", "surface"],
    ["ink", "action"],
    ["ink-muted", "background"],
    ["ink-muted", "surface"],
    ["action-strong", "background"],
    ["action-strong", "surface"],
    // A green button with white text.
    ["background", "action-strong"],
  ])("%s on %s reaches AA (at least 4.5:1)", ([text = "", background = ""]) => {
    expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("WhatsApp green as text does not reach AA, which is why action-strong exists", () => {
    expect(contrast(token("action"), token("background"))).toBeLessThan(4.5);
  });

  // Scenarios: form control outline; secondary button outline
  it.for([
    ["control", "background"],
    ["control", "surface"],
  ])("the outline of controls, %s on %s, reaches 3:1", ([outline = "", background = ""]) => {
    expect(contrast(token(outline), token(background))).toBeGreaterThanOrEqual(3);
  });

  // Scenario: touch areas. min-h-11 is 44px while nobody redefines the spacing.
  it("min-h-11 measures 44px: the spacing scale is Tailwind's", () => {
    expect(css).not.toMatch(/--spacing\s*:/);
  });
});

describe("Mobile-first design with no horizontal scroll", () => {
  // Scenario: no public screen blocks responsive collapse (in the code; the
  // served HTML is checked end to end).
  it("no component writes a class that blocks the collapse", () => {
    expect(components.length).toBeGreaterThanOrEqual(5);
    const problems = components.flatMap((file) =>
      classAttributesOf(readFileSync(file, "utf8")).flatMap((list) =>
        collapseProblems(list).map((problem) => `${relative(ROOT, file)}: ${problem}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("the guard catches what it guards", () => {
    for (const list of [
      "whitespace-nowrap",
      "sm:truncate",
      "min-w-64",
      "w-[420px]",
      "grid-cols-2",
      "flex-nowrap",
      "grid sm:grid-cols-2",
    ]) {
      expect(collapseProblems(list), list).not.toEqual([]);
    }
    for (const list of [
      "min-w-0",
      "grid grid-cols-1 sm:grid-cols-2",
      "max-w-3xl break-all min-h-11",
    ]) {
      expect(collapseProblems(list), list).toEqual([]);
    }
  });
});
