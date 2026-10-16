// Scenarios of docs/specs/public-directory.md, "Directory lists show 20 cards per page, with
// "Ver más" to the next (v2)", for the search results: a search that finds
// more businesses than a page shows. The seed has fewer, so this test adds 25
// fictitious published cards to Tizayuca, never in a migration or the seed,
// and removes them at the end. Published cards of Tizayuca are listed in the
// sitemap, which other tests compare with the seed, so this file runs in a
// project of its own (playwright.config.ts), after "phone" and before the
// second locality, while no other test runs. Numbers follow the 771999xxxx
// convention.
import { and, eq, like } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { newBusinessId } from "../../../src/core/business/id.ts";
import { businesses, categories } from "../../../src/core/db/schema/index.ts";
import { PAGE_SIZE } from "../../../src/core/pagination.ts";
import { withDatabase } from "../database.ts";

const TIZAYUCA_CODE = "13069";
const NAME = "Tamalería Paginada de Mentiras";
const TOTAL = PAGE_SIZE + 5;
const QUERY = "tamaleria paginada";

/** The names in the order the results show them: the most recently published first. */
const NEWEST_FIRST = Array.from(
  { length: TOTAL },
  (_, n) => `${NAME} ${String(TOTAL - n).padStart(2, "0")}`,
);

function removeFixtures(): Promise<void> {
  return withDatabase(async (db) => {
    await db
      .delete(businesses)
      .where(and(eq(businesses.localityCode, TIZAYUCA_CODE), like(businesses.name, `${NAME} %`)));
  });
}

test.beforeAll(async () => {
  await removeFixtures();
  await withDatabase(async (db) => {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, "restaurantes-y-fondas"));
    if (!category)
      throw new Error("e2e: no category restaurantes-y-fondas; are the migrations applied?");
    const base = Date.parse("2026-01-01T12:00:00Z");
    await db.insert(businesses).values(
      Array.from({ length: TOTAL }, (_, index) => {
        const n = index + 1;
        return {
          id: newBusinessId(),
          localityCode: TIZAYUCA_CODE,
          name: `${NAME} ${String(n).padStart(2, "0")}`,
          categoryId: category.id,
          whatsapp: `771999${String(6000 + n)}`,
          zoneOther: "Colonia Paginada de Mentiras",
          consentedToNoticeAt: new Date(base),
          status: "published" as const,
          // One a minute, so the order is known.
          publishedAt: new Date(base + n * 60_000),
        };
      }),
    );
  });
});

test.afterAll(async () => {
  await removeFixtures();
});

test.describe('Directory lists show 20 cards per page, with "Ver más" to the next (v2)', () => {
  test.use({ javaScriptEnabled: false });

  test('20 results, then "Ver más" leads to the rest, without JavaScript', async ({ page }) => {
    await page.goto(`/hidalgo/tizayuca/buscar?q=${encodeURIComponent(QUERY)}`);
    const main = page.getByRole("main");
    const names = () => main.getByRole("heading", { level: 2 }).allInnerTexts();

    await expect(main.getByRole("heading", { level: 1 })).toHaveText(`Resultados para "${QUERY}"`);
    expect(await names()).toEqual(NEWEST_FIRST.slice(0, PAGE_SIZE));
    const more = main.getByRole("link", { name: "Ver más" });
    await expect(more).toHaveAttribute(
      "href",
      "/hidalgo/tizayuca/buscar?q=tamaleria+paginada&pagina=2",
    );
    const box = await more.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);

    await more.click();

    await expect(page).toHaveURL(/\?q=tamaleria\+paginada&pagina=2$/);
    // The same query, still the only h1, and the box keeps it.
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(`Resultados para "${QUERY}"`);
    await expect(main.getByRole("searchbox")).toHaveValue(QUERY);
    expect(await names()).toEqual(NEWEST_FIRST.slice(PAGE_SIZE));
    // The last page has no "Ver más".
    await expect(main.getByRole("link", { name: "Ver más" })).toHaveCount(0);
    // Nor any page after it.
    const after = await page.goto(
      `/hidalgo/tizayuca/buscar?q=${encodeURIComponent(QUERY)}&pagina=3`,
    );
    expect(after?.status()).toBe(404);
  });
});
