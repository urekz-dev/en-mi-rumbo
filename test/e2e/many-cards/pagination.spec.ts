// docs/specs/public-directory.md, "Directory lists show 20 cards per page,
// with "Ver más" to the next (v2)", on the built site: a listing longer than a
// page. The seed leaves the category "Otro" empty, so this file publishes 21
// fictitious cards there before its tests and removes them after. It runs in
// its own project of playwright.config.ts ("phone, many cards"), after the
// others and alone, because those cards would change what the other files
// see: the sitemap, the crawls and the listing of "Otro". Never in the seed.
// Numbers follow the 771999xxxx convention.
import { expect, type Page, test } from "@playwright/test";
import { and, eq, like } from "drizzle-orm";
import { newBusinessId } from "../../../src/core/business/id.ts";
import { businesses, categories } from "../../../src/core/db/schema/index.ts";
import { withDatabase } from "../database.ts";

const TIZAYUCA = "13069";
const LISTING = "/hidalgo/tizayuca/otro";
const SITE_URL = "http://localhost:4321";
const COUNT = 21;
const PHONE_PREFIX = "77199920";
const DAY = 24 * 60 * 60 * 1000;

/** The name of the n-th card; the first is the most recently published. */
const nameOf = (n: number) => `Negocio de Paginación de Mentiras ${String(n).padStart(2, "0")}`;

async function removeCards(): Promise<void> {
  await withDatabase(async (db) => {
    await db
      .delete(businesses)
      .where(
        and(eq(businesses.localityCode, TIZAYUCA), like(businesses.whatsapp, `${PHONE_PREFIX}%`)),
      );
  });
}

test.beforeAll(async () => {
  await removeCards();
  await withDatabase(async (db) => {
    const [other] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, "otro"));
    if (!other) throw new Error('e2e: no category "otro"; are the migrations applied?');
    const now = Date.now();
    await db.insert(businesses).values(
      Array.from({ length: COUNT }, (_, index) => ({
        id: newBusinessId(),
        localityCode: TIZAYUCA,
        name: nameOf(index + 1),
        categoryId: other.id,
        whatsapp: `${PHONE_PREFIX}${String(index + 1).padStart(2, "0")}`,
        zoneOther: "Colonia de Paginación de Mentiras",
        consentedToNoticeAt: new Date(now - 60 * DAY),
        status: "published" as const,
        publishedAt: new Date(now - (index + 1) * DAY),
      })),
    );
  });
});

test.afterAll(async () => {
  await removeCards();
});

const cardNames = (page: Page) =>
  page.getByRole("main").getByRole("listitem").getByRole("heading", { level: 2 });

test.describe('Directory lists show 20 cards per page, with "Ver más" to the next (v2)', () => {
  test.use({ javaScriptEnabled: false });

  // Scenario: a listing longer than a page
  test('the first page shows 20 cards and "Ver más" leads to the next, with no JavaScript', async ({
    page,
  }) => {
    await page.goto(LISTING);

    await expect(cardNames(page)).toHaveText(
      Array.from({ length: 20 }, (_, index) => nameOf(index + 1)),
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE_URL}${LISTING}`,
    );
    const more = page.getByRole("link", { name: "Ver más" });
    await expect(more).toHaveAttribute("href", `${LISTING}?pagina=2`);
    const box = await more.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);

    await more.click();
    await expect(page).toHaveURL(`${LISTING}?pagina=2`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Otro en Tizayuca");
    await expect(cardNames(page)).toHaveText([nameOf(21)]);
    // Scenario: the last page
    await expect(page.getByRole("link", { name: "Ver más" })).toHaveCount(0);
    // Scenario: each page names itself
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE_URL}${LISTING}?pagina=2`,
    );
  });

  // Scenario: past the last page
  test("a page past the last answers 404", async ({ request }) => {
    expect((await request.get(`${LISTING}?pagina=3`)).status()).toBe(404);
  });

  test("the sitemap lists the listing once, and none of its later pages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();

    expect(xml.match(new RegExp(`<loc>${SITE_URL}${LISTING}</loc>`, "g"))).toHaveLength(1);
    expect(xml).not.toContain("pagina=");
  });
});
