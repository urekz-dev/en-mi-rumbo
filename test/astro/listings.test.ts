// Scenarios of docs/specs/public-directory.md for the parts of the listing
// pages, rendered with Astro's Container API: "Zone filter in the listing,
// without client-side JavaScript", "Indexable trade and zone page", "The
// listing card brings the essentials and WhatsApp without extra taps",
// "Heading levels never skip (v2)" and "Directory lists show 20 cards per
// page, with "Ver más" to the next (v2)"; and docs/specs/base-layout.md,
// "Every page declares its title, description, canonical and share preview
// (v2)", for a page that must not be indexed. What each page lists and links
// is decided in src/core/business/listing-page.ts
// (test/worker/listings.test.ts); the served pages are tested end to end
// (test/e2e/listings.spec.ts).
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import type { ZoneNav as ZoneNavData } from "../../src/core/business/listing-page.ts";
import type { ListingBusiness } from "../../src/core/business/listing.ts";
import type { ServedLocality } from "../../src/core/locality/served.ts";
import BusinessList from "../../src/components/BusinessList.astro";
import MoreLink from "../../src/components/MoreLink.astro";
import ZoneNav from "../../src/components/ZoneNav.astro";
import BaseLayout from "../../src/layouts/BaseLayout.astro";
import { collapseProblems } from "../responsive-rules.ts";

const TIZAYUCA: ServedLocality = {
  code: "13069",
  name: "Tizayuca",
  slug: "tizayuca",
  state: { code: "13", name: "Hidalgo", slug: "hidalgo" },
  timeZone: "America/Mexico_City",
  contactWhatsapp: "7719990100",
  othersActive: false,
  seat: null,
};

const LISTING = "/hidalgo/tizayuca/servicios-del-hogar";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

/** Every `<a>` of the HTML: its attributes and its text. */
function links(html: string): { attributes: string; text: string }[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(
    ([, attributes = "", text = ""]) => ({
      attributes,
      text: text.replace(/<[^>]+>/g, "").trim(),
    }),
  );
}

const attribute = (attributes: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];

describe("Zone filter in the listing, without client-side JavaScript", () => {
  const nav: ZoneNavData = {
    all: { path: LISTING, current: false },
    zones: [
      { name: "Atempa", path: `${LISTING}?colonia=atempa`, current: false },
      { name: "Huicalco", path: `${LISTING}?colonia=huicalco`, current: true },
    ],
  };

  // Scenarios: filtering by a zone; removing the filter
  it('offers "Todas las colonias" and each zone as links, with the current one marked', async () => {
    const html = await container.renderToString(ZoneNav, { props: { nav } });

    expect(html).toContain('<nav aria-label="Filtrar por colonia"');
    expect(html).not.toMatch(/<(select|button|script|form)\b/);
    expect(
      links(html).map(({ attributes, text }) => [
        text,
        attribute(attributes, "href")?.replaceAll("&amp;", "&"),
        attribute(attributes, "aria-current") ?? null,
      ]),
    ).toEqual([
      ["Todas las colonias", LISTING, null],
      ["Atempa", `${LISTING}?colonia=atempa`, null],
      ["Huicalco", `${LISTING}?colonia=huicalco`, "page"],
    ]);
  });

  it("the current option is visibly different, each option is 44px tall and none blocks the collapse", async () => {
    const html = await container.renderToString(ZoneNav, { props: { nav } });
    const classes = links(html).map(({ attributes }) => attribute(attributes, "class") ?? "");

    for (const list of classes) {
      expect(list.split(" ")).toContain("min-h-11");
      expect(collapseProblems(list)).toEqual([]);
      // Green is the main action's alone.
      expect(list).not.toMatch(/\bbg-action\b/);
    }
    expect(classes[2]).toContain("border-action-strong");
    expect(classes[1]).not.toContain("border-action-strong");
  });
});

describe('Directory lists show 20 cards per page, with "Ver más" to the next (v2)', () => {
  // Scenario: a listing longer than a page
  it('"Ver más" is a link to the next page, neutral and 44px tall', async () => {
    const html = await container.renderToString(MoreLink, {
      props: { href: `${LISTING}?colonia=huicalco&pagina=2` },
    });
    const [link] = links(html);

    expect(links(html)).toHaveLength(1);
    expect(link?.text).toBe("Ver más");
    expect(attribute(link?.attributes ?? "", "href")).toBe(
      `${LISTING}?colonia=huicalco&amp;pagina=2`,
    );
    const classes = attribute(link?.attributes ?? "", "class") ?? "";
    expect(classes.split(" ")).toContain("min-h-11");
    expect(classes).not.toMatch(/\bbg-action\b/);
  });

  // Scenario: the last page
  it('the last page has no "Ver más"', async () => {
    expect((await container.renderToString(MoreLink, { props: { href: null } })).trim()).toBe("");
  });
});

describe("Heading levels never skip (v2)", () => {
  const business = (id: string, name: string): ListingBusiness => ({
    id,
    name,
    categorySlug: "servicios-del-hogar",
    zoneName: "Huicalco",
    zoneSlug: "huicalco",
    homeDelivery: false,
    whatsapp: "7719990101",
    photoKey: null,
  });

  // Scenario: a listing
  it("each card of the list names its business in an h2, in the order given", async () => {
    const html = await container.renderToString(BusinessList, {
      props: {
        businesses: [
          business("b5q68b2e72", "Plomería Los Fontaneros Ficticios"),
          business("65r9anw94p", "Cerrajería La Llave Inventada"),
        ],
        locality: TIZAYUCA,
        analytics: null,
      },
    });

    expect([...html.matchAll(/<(h[1-6])\b/g)].map(([, level]) => level)).toEqual(["h2", "h2"]);
    expect(html.match(/<li\b/g)).toHaveLength(2);
    expect(html.indexOf("Plomería Los Fontaneros")).toBeLessThan(html.indexOf("Cerrajería"));
  });

  it("an empty list draws nothing", async () => {
    const html = await container.renderToString(BusinessList, {
      props: { businesses: [], locality: TIZAYUCA, analytics: null },
    });
    expect(html.trim()).toBe("");
  });
});

describe("Trade pages without published businesses are neither indexed nor linked, but are not 404 either", () => {
  /** The head of a page rendered inside the layout. */
  async function head(props: Record<string, unknown>): Promise<string> {
    const html = await container.renderToString(BaseLayout, {
      partial: false,
      props: { title: "Clases de box en Tizayuca", ...props },
      slots: { default: "<h1>Clases de box en Tizayuca</h1>" },
      locals: { locality: TIZAYUCA } as App.Locals,
    });
    return /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? "";
  }

  // Scenario: the empty is not indexed
  it("a page that must not be indexed says so, lets its links be followed and declares no canonical", async () => {
    const html = await head({ canonicalPath: "/hidalgo/tizayuca/box", noindex: true });

    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:url"');
  });

  // Scenario: what does have content is indexed
  it("an indexable page declares no robots instruction, and its canonical", async () => {
    const html = await head({ canonicalPath: "/hidalgo/tizayuca/box" });

    expect(html).not.toContain('name="robots"');
    expect(html).toContain(
      '<link rel="canonical" href="http://localhost:4321/hidalgo/tizayuca/box">',
    );
  });
});
