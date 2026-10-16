// The 8 categories of the catalogue (ADR 0006, global to every locality), as
// the large buttons that lead to their listings show them
// (docs/specs/public-directory.md, "The home page shows the 8 categories as
// large buttons", "With no results, the page offers the categories as an
// alternative" and "Empty query and hostile terms bounded, without error").
//
// Binding: the public pages read them on HYPERDRIVE, the cached binding of
// public reads; the catalogue only changes in a data migration.
import { asc } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { categories } from "../db/schema/index.ts";
import type { CatalogueEntry } from "./root-urls.ts";

/**
 * The category that the home's "Deporte en {municipio}" block highlights
 * (docs/specs/public-directory.md, "Highlighted "Deporte en Tizayuca" block on
 * the home page", PRD §6.5): its entry leads to this category's listing, the
 * same one its button leads to. A slug of the global catalogue
 * (drizzle/0007_categories_trades.sql), not a page of its own.
 */
export const SPORTS_CATEGORY_SLUG = "clubes-y-escuelas-deportivas";

/**
 * Every category, in catalogue order: the order of the PRD, which the data
 * migration kept in the identifiers (drizzle/0007_categories_trades.sql).
 */
export function catalogueCategories(db: Db): Promise<CatalogueEntry[]> {
  return db
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .orderBy(asc(categories.id));
}
