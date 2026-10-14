// Global catalogues (ADR 0006): every locality sees the same categories and
// trades, and their slugs are unique across the system.
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { matches, SLUG_PATTERN } from "./checks.ts";

/** The eight categories of the registration form and the home page. */
export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
  },
  (t) => [check("categories_slug_check", matches(t.slug, SLUG_PATTERN))],
);

/** Trades the admin assigns to a business on approval (one to three). */
export const trades = pgTable(
  "trades",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
  },
  (t) => [check("trades_slug_check", matches(t.slug, SLUG_PATTERN))],
);
