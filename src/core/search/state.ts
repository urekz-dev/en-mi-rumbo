// What the results page found out before it renders (docs/specs/
// public-directory.md, "Results page with the same cards as the listing",
// "With no results, the page offers the categories as an alternative",
// "Empty query and hostile terms bounded, without error" and "The search
// endpoint has a per-IP quota (v2)"): src/pages/[state]/[municipality]/
// buscar.astro decides it, and src/components/SearchPage.astro renders it.
import type { ListingBusiness } from "../business/listing.ts";
import type { CatalogueEntry } from "../catalogue/root-urls.ts";

export type SearchState =
  /** Nothing searchable was typed: no query ran. */
  | { kind: "empty"; categories: readonly CatalogueEntry[] }
  /** One page of results, and the address of the next one, if any. */
  | { kind: "results"; businesses: readonly ListingBusiness[]; next: string | null }
  /** The query ran and found nothing. */
  | { kind: "no-results"; categories: readonly CatalogueEntry[] }
  /** The address is over the search quota: no query ran. */
  | { kind: "over-quota"; categories: readonly CatalogueEntry[] };
