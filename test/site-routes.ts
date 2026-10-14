// The routes of the site as Astro reads them from src/pages, for the checks of
// docs/specs/base-layout.md, "Internal links to existing routes and protected
// external links": test/scripts/internal-links.test.ts (links written in the
// source) and test/e2e/internal-links.spec.ts (links on the rendered pages).
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGES = fileURLToPath(new URL("../src/pages/", import.meta.url));
const PAGE_EXTENSIONS = /\.(astro|ts|js|md|mdx|html)$/;

/** The route of a file under src/pages, such as `/robots.txt` or `/[state]/[municipality]`. */
export function routeOf(file: string): string {
  const path = file.replace(PAGE_EXTENSIONS, "").split(/[\\/]/);
  if (path.at(-1) === "index") path.pop();
  return `/${path.join("/")}`;
}

/** Every route of the site; files and folders starting with `_` are not routes. */
export function siteRoutes(pages: string = PAGES): string[] {
  return readdirSync(pages, { recursive: true, encoding: "utf8" })
    .filter((file) => PAGE_EXTENSIONS.test(file))
    .filter((file) => !file.split(/[\\/]/).some((part) => part.startsWith("_")))
    .map(routeOf)
    .toSorted();
}

/**
 * The routes with no parameter: the only ones a link may name literally. A
 * page of a locality, a category or a card is reached through a dynamic
 * route, and its link is built from the data (`localityPath`).
 */
export function staticRoutes(pages: string = PAGES): Set<string> {
  return new Set(siteRoutes(pages).filter((route) => !route.includes("[")));
}

/** A path without its query, fragment or trailing slash, to compare with a route. */
export function routePath(link: string): string {
  const path = link.replace(/[?#].*$/, "");
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}
