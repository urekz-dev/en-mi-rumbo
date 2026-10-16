// The pages of a list of cards (docs/specs/public-directory.md, "Directory
// lists show 20 cards per page, with "Ver más" to the next (v2)"): the
// listings by category, by trade and by trade and zone, and the search
// results. Page 1 is the URL without `pagina`; page n is `?pagina=n`. Pure.

/** Cards per page, by decision of the product owner (2026-10-15). */
export const PAGE_SIZE = 20;

/** A page after the first: a positive integer without leading zeros. */
const LATER_PAGE = /^[1-9][0-9]*$/;

/**
 * The page a `pagina` value asks for: 1 when there is none, the number when
 * it is a later page written as one, such as "2". Anything else is null, and
 * the page answers 404, so no list has a duplicate or a junk URL: "1" (page 1
 * is the URL without `pagina`), "0", "-1", "01", "2.5", "abc", an empty value
 * or a number too large to count.
 */
export function parsePage(value: string | null): number | null {
  if (value === null) return 1;
  if (!LATER_PAGE.test(value)) return null;
  const page = Number(value);
  return page > 1 && Number.isSafeInteger(page) ? page : null;
}

/**
 * The rows a query reads for `page`: one more than a page holds, which tells
 * whether a next page exists, after skipping the earlier pages.
 */
export function pageSlice(page: number): { limit: number; offset: number } {
  return { limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE };
}
