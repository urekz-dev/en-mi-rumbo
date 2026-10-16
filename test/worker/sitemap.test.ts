// Scenarios of docs/specs/base-layout.md, requirements "The sitemap lists the
// pages that exist, from the database (v2)", "Canonical URLs, share previews
// and the sitemap use the full locality path (v2)" and "The sitemap includes
// the two legal pages (v2)": src/core/seo/sitemap.ts against the database,
// with the fixture localities of this file (one active, one inactive). That
// every URL of the served sitemap answers 200 is checked end to end
// (test/e2e/seo.spec.ts). Other test files add active fixture localities while
// this one runs, so the checks look only at this file's state and at the
// site's own pages.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { localities } from "../../src/core/db/schema/index.ts";
import { sitemapEntries, sitemapXml, type SitemapEntry } from "../../src/core/seo/sitemap.ts";
import { cleanup, createFixture, db, type Fixture } from "./fixtures.ts";

const STATE = "93";
const PREFIX = `/estado-de-prueba-${STATE}/`;
const ORIGIN = "https://stage-enmirumbo.urekz.workers.dev";
let f: Fixture;

beforeAll(async () => {
  f = await createFixture(STATE);
});

afterAll(async () => {
  await cleanup(STATE);
});

/** The paths of this file's localities among the entries. */
function ours(entries: readonly SitemapEntry[]): string[] {
  return entries.map(({ path }) => path).filter((path) => path.startsWith(PREFIX));
}

describe("The sitemap lists the pages that exist, from the database (v2)", () => {
  it("lists the home of every active locality, and nothing of an inactive one", async () => {
    const entries = await db(sitemapEntries);

    expect(ours(entries)).toEqual([`${PREFIX}pueblo-uno`]);
  });

  it("activating a locality adds its home on the next read, with no other change", async () => {
    await db((tx) =>
      tx.update(localities).set({ active: true }).where(eq(localities.code, f.localityB)),
    );
    try {
      expect(ours(await db(sitemapEntries))).toEqual([
        `${PREFIX}pueblo-dos`,
        `${PREFIX}pueblo-uno`,
      ]);
    } finally {
      await db((tx) =>
        tx.update(localities).set({ active: false }).where(eq(localities.code, f.localityB)),
      );
    }
  });

  // Scenario: legal pages in the sitemap
  it("lists the two legal pages once, whatever the number of localities", async () => {
    const paths = (await db(sitemapEntries)).map(({ path }) => path);

    expect(paths.filter((path) => path === "/aviso-de-privacidad")).toHaveLength(1);
    expect(paths.filter((path) => path === "/terminos")).toHaveLength(1);
  });

  // Scenario: no private or search pages
  it("lists no panel, search, report, thank-you or edit page", async () => {
    for (const { path } of await db(sitemapEntries)) {
      expect(path).not.toMatch(/^\/admin|\/buscar|\/reportar|\/gracias|\/editar/);
    }
  });
});

describe("Canonical URLs, share previews and the sitemap use the full locality path (v2)", () => {
  // Scenario: sitemap entries
  it("every entry is absolute, from the site URL, and a locality's carries its state and municipality", () => {
    const xml = sitemapXml(ORIGIN, [
      { path: "/hidalgo/tizayuca" },
      { path: `${PREFIX}pueblo-uno` },
      { path: "/aviso-de-privacidad" },
    ]);

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        `  <url><loc>${ORIGIN}/hidalgo/tizayuca</loc></url>\n` +
        `  <url><loc>${ORIGIN}${PREFIX}pueblo-uno</loc></url>\n` +
        `  <url><loc>${ORIGIN}/aviso-de-privacidad</loc></url>\n` +
        "</urlset>\n",
    );
  });

  // Scenario: card date (the shape D3 fills in)
  it("an entry with a last modification date declares it", () => {
    const xml = sitemapXml(ORIGIN, [
      { path: "/hidalgo/tizayuca/negocio/x-1", lastModified: new Date("2026-10-15T23:30:00Z") },
    ]);
    expect(xml).toContain(
      `<url><loc>${ORIGIN}/hidalgo/tizayuca/negocio/x-1</loc><lastmod>2026-10-15</lastmod></url>`,
    );
  });

  it("escapes what XML needs escaped", () => {
    expect(sitemapXml(ORIGIN, [{ path: "/a?b=1&c=2" }])).toContain(
      `<loc>${ORIGIN}/a?b=1&amp;c=2</loc>`,
    );
  });

  // Base layout, "Production without a declared public URL"
  it("without a base for absolute URLs it is a valid, empty sitemap", () => {
    expect(sitemapXml(null, [{ path: "/hidalgo/tizayuca" }])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "</urlset>\n",
    );
  });
});
