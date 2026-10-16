// docs/specs/public-directory.md, "Directory lists show 20 cards per page,
// with "Ver más" to the next (v2)": the page a `pagina` value asks for, the
// rows a query reads for it (src/core/pagination.ts) and the paths of a
// listing's pages (src/core/business/listing-page.ts). Pure. The listings that
// paginate are tested against the database in test/worker/listings.test.ts.
import { describe, expect, it } from "vite-plus/test";
import { listingPath } from "../../src/core/business/listing-page.ts";
import { PAGE_SIZE, pageSlice, parsePage } from "../../src/core/pagination.ts";

describe('Directory lists show 20 cards per page, with "Ver más" to the next (v2)', () => {
  it("a page holds 20 cards", () => {
    expect(PAGE_SIZE).toBe(20);
  });

  it("the URL without `pagina` is page 1", () => {
    expect(parsePage(null)).toBe(1);
  });

  it.each([
    ["2", 2],
    ["3", 3],
    ["10", 10],
    ["9007199254740991", 9007199254740991],
  ])("`pagina=%s` is page %d", (value, page) => {
    expect(parsePage(value)).toBe(page);
  });

  // Scenario: a page number that is not one
  it.each([
    "1",
    "0",
    "-1",
    "01",
    "002",
    "2.5",
    "2e1",
    "+2",
    " 2",
    "2 ",
    "abc",
    "",
    "١٢",
    "9007199254740993",
    "99999999999999999999999",
  ])("`pagina=%j` asks for no page, so the page answers 404", (value) => {
    expect(parsePage(value)).toBeNull();
  });

  it("a query reads one card more than a page holds, after the earlier pages", () => {
    expect(pageSlice(1)).toEqual({ limit: 21, offset: 0 });
    expect(pageSlice(2)).toEqual({ limit: 21, offset: 20 });
    expect(pageSlice(5)).toEqual({ limit: 21, offset: 80 });
  });

  it("the path of a page: page 1 without `pagina`, the zone filter first", () => {
    const path = "/hidalgo/tizayuca/servicios-del-hogar";
    expect(listingPath(path, {})).toBe(path);
    expect(listingPath(path, { page: 1 })).toBe(path);
    expect(listingPath(path, { page: 2 })).toBe(`${path}?pagina=2`);
    expect(listingPath(path, { zone: "huicalco" })).toBe(`${path}?colonia=huicalco`);
    expect(listingPath(path, { zone: "huicalco", page: 3 })).toBe(
      `${path}?colonia=huicalco&pagina=3`,
    );
  });
});
