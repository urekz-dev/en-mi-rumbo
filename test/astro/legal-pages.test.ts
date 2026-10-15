// Scenarios of docs/specs/legal-pages.md on the rendered legal pages, with
// Astro's Container API: the document, the version line, the draft mark, the
// links, the metadata, no locality, and that each page publishes exactly the
// content of src/core/legal/ (which is what the notice's fingerprint covers).
// The served pages are tested end to end in test/e2e/legal-pages.spec.ts.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { isExternal, lastUpdatedLine, type LegalDocument } from "../../src/core/legal/document.ts";
import { PUBLISHED_DRAFT_MARK } from "../../src/core/legal/placeholders.ts";
import { PRIVACY_NOTICE, PRIVACY_NOTICE_PAGE } from "../../src/core/legal/privacy-notice.ts";
import { TERMS, TERMS_PAGE } from "../../src/core/legal/terms.ts";
import { NOTICE_VERSION } from "../../src/core/legal/version.ts";
import PrivacyNoticePage from "../../src/pages/aviso-de-privacidad.astro";
import TermsPage from "../../src/pages/terminos.astro";
import { brandFindings } from "../brand-rules.ts";

let container: AstroContainer;
let noticeHtml: string;
let termsHtml: string;

beforeAll(async () => {
  container = await AstroContainer.create();
  // No locality in Astro.locals: these pages live outside every locality.
  noticeHtml = await container.renderToString(PrivacyNoticePage, { partial: false });
  termsHtml = await container.renderToString(TermsPage, { partial: false });
});

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function element(html: string, tag: string): string {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(html)?.[1] ?? "";
}

function meta(html: string, name: string): string | undefined {
  const tag = new RegExp(`<meta name="${name}"[^>]*>`).exec(html)?.[0];
  return tag === undefined ? undefined : /content="([^"]*)"/.exec(tag)?.[1];
}

/** The text blocks of the article, in order, as `tag text` (and `a href text`). */
function renderedBlocks(html: string): string[] {
  const article = element(html, "article");
  return [...article.matchAll(/<(h1|h2|h3|p|li|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(
    ([, tag, attributes = "", inner = ""]) => {
      const href = /href="([^"]*)"/.exec(attributes)?.[1];
      return href === undefined ? `${tag} ${decode(inner)}` : `${tag} ${href} ${decode(inner)}`;
    },
  );
}

/** What the page must show, block by block, from the data of the document. */
function expectedBlocks(document: LegalDocument, version?: string): string[] {
  const blocks = [`h1 ${document.title}`];
  if (PUBLISHED_DRAFT_MARK !== null) blocks.push(`p ${PUBLISHED_DRAFT_MARK}`);
  blocks.push(
    `p ${version === undefined ? "" : `Versión ${version} · `}${lastUpdatedLine(document)}`,
    `p ${document.introduction}`,
  );
  for (const section of document.sections) {
    blocks.push(`h2 ${section.heading}`);
    for (const block of section.blocks) {
      if (block.kind === "paragraph") blocks.push(`p ${block.text}`);
      else if (block.kind === "list") blocks.push(...block.items.map((item) => `li ${item}`));
      else blocks.push(`a ${block.href} ${block.text}`);
    }
  }
  if (document.closingLink) {
    blocks.push(`a ${document.closingLink.href} ${document.closingLink.text}`);
  }
  return blocks.map((block) => block.replace(/\s+/g, " ").trim());
}

/** Every link of a fragment, as [href, text]. */
function links(html: string): [string, string][] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href = "", text = ""]) => [href, decode(text)],
  );
}

describe("Full privacy notice page at `/aviso-de-privacidad`", () => {
  // Scenario: the owner opens the privacy notice
  it("renders the notice inside the layout, with the version line and its date", () => {
    expect(noticeHtml).toMatch(/^<!DOCTYPE html><html lang="es-MX"[ >]/i);
    for (const landmark of ["header", "main", "footer"]) {
      expect(noticeHtml.match(new RegExp(`<${landmark}\\b`, "g")), landmark).toHaveLength(1);
    }
    expect(decode(element(noticeHtml, "h1"))).toBe("Aviso de privacidad");
    expect(renderedBlocks(noticeHtml)).toContain(
      "p Versión 2 · Última actualización: [FECHA DE PUBLICACIÓN]",
    );
  });

  // Scenario: the version shown is the current one
  it("the version shown is the one declared in src/core/legal/version.ts", () => {
    expect(renderedBlocks(noticeHtml)).toContain(
      `p Versión ${NOTICE_VERSION} · ${lastUpdatedLine(PRIVACY_NOTICE)}`,
    );
  });

  // Scenarios: heading hierarchy of the notice; the published text is the approved one
  it("publishes exactly the content of the notice, one h1 and every section as an h2", () => {
    expect(renderedBlocks(noticeHtml)).toEqual(expectedBlocks(PRIVACY_NOTICE, NOTICE_VERSION));
    expect(noticeHtml.match(/<h1\b/g)).toHaveLength(1);
    expect(noticeHtml.match(/<h2\b/g)).toHaveLength(PRIVACY_NOTICE.sections.length);
    expect(noticeHtml).not.toMatch(/<h[3-6]\b/);
    expect(noticeHtml).not.toMatch(/lorem ipsum/i);
  });

  // Scenario: the notice links to the terms
  it("ends with the link to the terms, and its only external link opens apart", () => {
    const article = element(noticeHtml, "article");
    expect(links(article).at(-1)).toEqual(["/terminos", "Términos y condiciones"]);
    for (const tag of article.match(/<a\b[^>]*>/g) ?? []) {
      const href = /href="([^"]*)"/.exec(tag)?.[1] ?? "";
      if (isExternal(href as never)) {
        expect(tag).toContain('target="_blank"');
        expect(tag).toContain('rel="noopener noreferrer"');
      } else {
        expect(tag).not.toContain("target=");
      }
    }
  });
});

describe("Terms and conditions page at `/terminos`", () => {
  // Scenarios: the resident opens the terms; the published text is the approved one
  it("publishes exactly the terms, with no version on the last-update line", () => {
    expect(decode(element(termsHtml, "h1"))).toBe("Términos y condiciones");
    expect(renderedBlocks(termsHtml)).toEqual(expectedBlocks(TERMS));
    expect(renderedBlocks(termsHtml)).toContain("p Última actualización: [FECHA DE PUBLICACIÓN]");
    expect(termsHtml).not.toMatch(/Versión \d/);
  });

  // Scenario: the terms link to the privacy notice
  it("links to the privacy notice", () => {
    expect(links(element(termsHtml, "article"))).toEqual([
      ["/aviso-de-privacidad", "Aviso de privacidad"],
    ]);
  });
});

describe("Visible placeholders and a draft mark while the responsible party's data is missing", () => {
  // Scenarios: draft mark visible; the responsible party's address does not exist yet
  it.for([
    ["the notice", () => noticeHtml],
    ["the terms", () => termsHtml],
  ] as const)("%s shows the draft mark at the top, under the h1", ([, html]) => {
    const blocks = renderedBlocks(html());
    expect(blocks[1]).toBe(
      "p Ojo: este texto todavía es un borrador. Nos faltan los datos que ves entre corchetes y la revisión legal antes de que el directorio se lance.",
    );
  });

  it("the notice shows the address of the responsible party as a placeholder", () => {
    expect(decode(noticeHtml)).toContain(
      "con domicilio en [DOMICILIO DEL RESPONSABLE — completar antes del lanzamiento].",
    );
  });
});

describe("The two legal pages are indexable and have their own metadata", () => {
  // Scenarios: no noindex; own title and description
  it.for([
    ["/aviso-de-privacidad", () => noticeHtml, PRIVACY_NOTICE_PAGE],
    ["/terminos", () => termsHtml, TERMS_PAGE],
  ] as const)(
    "%s has its own title and description and asks nothing of search engines",
    ([, html, page]) => {
      expect(decode(element(html(), "title"))).toBe(`${page.title} — enmirumbo`);
      expect(meta(html(), "description")).toBe(page.description.replaceAll('"', "&quot;"));
      expect(meta(html(), "robots")).toBeUndefined();
      expect(html()).not.toMatch(/noindex/i);
    },
  );

  it("the two descriptions differ from each other and say what each document is", () => {
    expect(PRIVACY_NOTICE_PAGE.description).not.toBe(TERMS_PAGE.description);
    expect(PRIVACY_NOTICE_PAGE.description).toContain("derechos ARCO");
    expect(TERMS_PAGE.description).toContain("reglas de moderación");
  });
});

describe("The legal pages are mobile-first Server Components without client JavaScript", () => {
  // Scenario: no client JavaScript
  it("neither page sends a script", () => {
    expect(noticeHtml).not.toMatch(/<script\b/i);
    expect(termsHtml).not.toMatch(/<script\b/i);
  });

  // Scenario: they read well on the phone (touch areas; the width is measured end to end)
  it("every link of the documents has a 44px touch area", () => {
    for (const html of [noticeHtml, termsHtml]) {
      for (const tag of element(html, "article").match(/<a\b[^>]*>/g) ?? []) {
        expect(tag).toMatch(/\bmin-h-11\b/);
      }
    }
  });
});

describe("The legal pages are prerendered, belong to no locality and name none (v2)", () => {
  // Scenario: no locality named
  it("neither page names a locality, in its text, its metadata or its footer", () => {
    for (const html of [noticeHtml, termsHtml]) {
      expect(html).not.toMatch(/tizayuca|hidalgo/i);
      expect(html).not.toContain("Hecho para los vecinos");
      expect(links(element(html, "header"))).toEqual([["/", "enmirumbo"]]);
      expect(brandFindings(decode(html))).toEqual([]);
    }
  });
});
