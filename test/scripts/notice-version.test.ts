// THE GUARD of the privacy notice: docs/specs/legal-pages.md, requirements
// "The privacy notice has a stable version declared in a single place",
// "Changing the notice text without bumping the version breaks the
// verification" and "The notice takes a new version with the rebuild, and
// earlier consents keep their evidence (v2)".
//
// The table of fingerprints lives here, next to the verification, and not
// next to the text (src/core/legal/): fixing a comma of the notice and
// "fixing" its fingerprint must never be the same absent-minded edit.
//
// IF THIS SUITE IS RED: never edit the fingerprint of a version already
// published. Raise NOTICE_VERSION in src/core/legal/version.ts and add a row
// to FINGERPRINTS with the fingerprint the failure prints. Filling in a
// placeholder or removing the draft mark changes the notice too.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { LegalDocument } from "../../src/core/legal/document.ts";
import { DRAFT_MARK } from "../../src/core/legal/placeholders.ts";
import {
  CONSENT_CHECKBOX,
  PRIVACY_NOTICE,
  SIMPLIFIED_NOTICE_TEMPLATE,
} from "../../src/core/legal/privacy-notice.ts";
import { TERMS } from "../../src/core/legal/terms.ts";
import {
  CURRENT_NOTICE_PIECES,
  NOTICE_VERSION,
  versionedNoticeContent,
  type NoticePieces,
} from "../../src/core/legal/version.ts";
import { filesUnder, ROOT } from "./source-files.ts";

/**
 * The fingerprint of every published version of the notice, in order. The
 * row of a published version never changes: it is the proof of which text
 * the consent records that cite it were given against.
 *
 * The prototype anchored its versions 1 and 2 in its own repository, over
 * its own text and with its own algorithm; no consent record of this
 * database cites them. This table starts with the text of the rebuild.
 */
const FINGERPRINTS: readonly (readonly [version: string, sha256: string])[] = [
  ["2", "36dcdc6ff214da52cf04268581936490a3fe27780e10ad03f61e5cfcdf096b69"],
];

/**
 * The SHA-256 of the versioned content. The separator cannot appear in the
 * text, so moving a sentence to another block changes the fingerprint.
 */
function fingerprint(content: readonly string[]): string {
  return createHash("sha256").update(content.join("\u0000")).digest("hex");
}

/**
 * The guard: null when the version and the text agree, or what to do. The
 * same function runs against the published notice and against the mutated
 * copies below; a copy of it would prove nothing.
 */
function checkVersionAndText(
  version: string,
  content: readonly string[],
  table: readonly (readonly [string, string])[] = FINGERPRINTS,
): string | null {
  const current = fingerprint(content);
  const anchor = `Anchor the row ["${version}", "${current}"] in test/scripts/notice-version.test.ts.`;
  const last = table.at(-1);
  if (last === undefined) return `The table of fingerprints is empty. ${anchor}`;
  if (last[0] !== version) {
    return `The current notice version is "${version}" and the last anchored one is "${last[0]}": the current version must always be the last row of the table. ${anchor}`;
  }
  if (last[1] !== current) {
    return `The text of the privacy notice changed without a new version: the fingerprint of version "${version}" is no longer the anchored one. Raise NOTICE_VERSION in src/core/legal/version.ts and add a new row to the table (never edit the row of a published version). Fingerprint of today's text: ${current}`;
  }
  return null;
}

/** A copy of the full notice with one paragraph of one section changed. */
function withParagraph(document: LegalDocument, heading: string, text: string): LegalDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.heading === heading
        ? { ...section, blocks: [{ kind: "paragraph", text }, ...section.blocks.slice(1)] }
        : section,
    ),
  };
}

function mutated(change: Partial<NoticePieces>): string[] {
  return versionedNoticeContent({ ...CURRENT_NOTICE_PIECES, ...change });
}

describe("The privacy notice has a stable version declared in a single place", () => {
  // Scenario: the current version
  it("the current version is 2, a whole number written as a string", () => {
    expect(NOTICE_VERSION).toBe("2");
    expect(NOTICE_VERSION).toMatch(/^[1-9]\d*$/);
  });

  // Scenario: a single source of the version
  it("the version is declared once, and no file writes it by hand", () => {
    const files = [...filesUnder(join(ROOT, "src")), ...filesUnder(join(ROOT, "scripts"))].filter(
      (file) => /\.(astro|ts|mjs|js)$/.test(file),
    );
    expect(files.length).toBeGreaterThan(30);
    const version = NOTICE_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const byHand = new RegExp(`versi[oó]n\\s+${version}\\b`, "i");
    const declarations: string[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const name = relative(ROOT, file);
      const source = readFileSync(file, "utf8");
      if (/\bNOTICE_VERSION\s*=/.test(source)) declarations.push(name);
      if (name !== "src/core/legal/version.ts" && byHand.test(source)) problems.push(name);
    }
    expect(declarations).toEqual(["src/core/legal/version.ts"]);
    expect(problems).toEqual([]);
  });
});

describe("Changing the notice text without bumping the version breaks the verification", () => {
  // The guard itself, against the published notice.
  it("the published text matches the fingerprint anchored for the current version", () => {
    expect(checkVersionAndText(NOTICE_VERSION, versionedNoticeContent())).toBeNull();
  });

  // Scenario: version without a fingerprint (the green side)
  it("the current version is anchored and is the last row of the table", () => {
    expect(FINGERPRINTS.at(-1)?.[0]).toBe(NOTICE_VERSION);
    const versions = FINGERPRINTS.map(([version]) => Number(version));
    expect(versions).toEqual(versions.toSorted((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    for (const [, sha256] of FINGERPRINTS) expect(sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  // Scenario: someone edits the notice and does not bump the version
  it.for([
    [
      "a sentence of the full notice",
      () =>
        mutated({
          fullNotice: withParagraph(
            PRIVACY_NOTICE,
            "Con quién compartimos tus datos",
            "Con casi nadie. No vendemos, no rentamos ni intercambiamos tus datos.",
          ),
        }),
    ],
    [
      "the simplified notice",
      () => mutated({ simplifiedNotice: SIMPLIFIED_NOTICE_TEMPLATE.replace("20 días", "30 días") }),
    ],
    [
      "the literal of the checkbox",
      () => mutated({ consentCheckbox: CONSENT_CHECKBOX.replace("Acepto", "Leí y acepto") }),
    ],
    [
      "the destination of a link",
      () =>
        mutated({
          fullNotice: {
            ...PRIVACY_NOTICE,
            closingLink: { text: "Términos y condiciones", href: "/aviso-de-privacidad" },
          },
        }),
    ],
    [
      "the order of two sections",
      () =>
        mutated({
          fullNotice: { ...PRIVACY_NOTICE, sections: PRIVACY_NOTICE.sections.toReversed() },
        }),
    ],
  ] as const)("fails when %s changes and the version does not", ([, content]) => {
    const problem = checkVersionAndText(NOTICE_VERSION, content());
    expect(problem).toMatch(/changed without a new version/);
    expect(problem).toMatch(/Raise NOTICE_VERSION in src\/core\/legal\/version\.ts/);
  });

  // Scenario: the guard does not get in the way of the placeholders
  it("filling in a placeholder fails until a new version is released", () => {
    const filled = JSON.parse(
      JSON.stringify(PRIVACY_NOTICE).replaceAll(
        "[DOMICILIO DEL RESPONSABLE — completar antes del lanzamiento]",
        "Calle Ficticia 123",
      ),
    ) as LegalDocument;
    expect(checkVersionAndText(NOTICE_VERSION, mutated({ fullNotice: filled }))).toMatch(
      /changed without a new version/,
    );
  });

  // Scenario: removing the draft mark also releases a new version
  it("removing the draft mark fails until a new version is released", () => {
    expect(CURRENT_NOTICE_PIECES.draftMark).toBe(DRAFT_MARK);
    expect(checkVersionAndText(NOTICE_VERSION, mutated({ draftMark: null }))).toMatch(
      /changed without a new version/,
    );
  });

  // Scenario: version without a fingerprint
  it("raising the version without anchoring its fingerprint fails", () => {
    expect(checkVersionAndText("3", versionedNoticeContent())).toMatch(
      /current notice version is "3" and the last anchored one is "2"/,
    );
    expect(checkVersionAndText(NOTICE_VERSION, versionedNoticeContent(), [])).toMatch(/empty/);
  });

  // Scenario: a new version is released together with the text
  it("a new version with its fingerprint passes, and the earlier rows stay as they were", () => {
    const content = mutated({ consentCheckbox: `${CONSENT_CHECKBOX} Y ya.` });
    const table = [...FINGERPRINTS, ["3", fingerprint(content)] as const];
    expect(checkVersionAndText("3", content, table)).toBeNull();
    expect(table.slice(0, -1)).toEqual(FINGERPRINTS);
  });

  // What the fingerprint covers: what a person reads, not how it is written.
  it("whitespace that HTML collapses does not change the fingerprint", () => {
    const reflowed = mutated({
      consentCheckbox: CONSENT_CHECKBOX.replaceAll(" ", "  \n "),
      simplifiedNotice: ` ${SIMPLIFIED_NOTICE_TEMPLATE}\n`,
    });
    expect(fingerprint(reflowed)).toBe(fingerprint(versionedNoticeContent()));
  });

  it("covers the three pieces in reading order, the draft mark included, and never the version line", () => {
    const content = versionedNoticeContent();
    const text = content.join("\n");
    expect(content.slice(0, 4)).toEqual([
      `simplified ${SIMPLIFIED_NOTICE_TEMPLATE}`,
      `checkbox ${CONSENT_CHECKBOX}`,
      "h1 Aviso de privacidad",
      `draft ${DRAFT_MARK}`,
    ]);
    expect(content).toContain("updated Última actualización: [FECHA DE PUBLICACIÓN]");
    expect(content).toContain(`intro ${PRIVACY_NOTICE.introduction}`);
    expect(content).toContain("h2 Tus derechos ARCO");
    expect(content).toContain(
      "li Pide que borremos todo: eliminamos tu registro de forma definitiva, no solo lo escondemos.",
    );
    expect(content.at(-1)).toBe("a /terminos Términos y condiciones");
    expect(text).not.toMatch(/Versión\s+\d/);
    expect(text).not.toContain(TERMS.introduction);
    for (const piece of content) expect(piece.trim()).not.toBe("");
  });
});
