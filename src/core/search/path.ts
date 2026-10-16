// The address of the search results of a locality (docs/specs/
// public-directory.md, "Results page with the same cards as the listing" and
// "Directory lists show 20 cards per page, with "Ver más" to the next (v2)"):
// `/{estado}/{municipio}/buscar?q=<query>`, and `&pagina=<n>` from the second
// page on. `buscar` is a reserved segment (src/core/catalogue/root-urls.ts).
import { localityPath, type LocalityRef } from "../locality/paths.ts";

/** The path segment of the results page. */
export const SEARCH_SEGMENT = "buscar";

/** The parameter of the query, which the search box's field is named after. */
export const QUERY_PARAM = "q";

/** The parameter of a later page. */
export const PAGE_PARAM = "pagina";

/**
 * The results of `query` in `locality`, at `page`; without a query, the page
 * itself, which the search box posts to.
 */
export function searchPath(locality: LocalityRef, query?: string, page = 1): string {
  const path = localityPath(locality, SEARCH_SEGMENT);
  if (query === undefined) return path;
  const params = new URLSearchParams({ [QUERY_PARAM]: query });
  if (page > 1) params.set(PAGE_PARAM, String(page));
  return `${path}?${params.toString()}`;
}
