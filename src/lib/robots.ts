// What search engines may index, per environment (ADR 0008). Every deployed
// environment, production included, stays out of search results until the
// cut-over: each Worker response carries `X-Robots-Tag: noindex` and
// `/robots.txt` closes the whole site. Static assets, such as the prerendered
// legal pages, never reach the Worker: the build gives them the same header
// through `_headers`, by the same rule (src/integrations/static-headers.ts).
// Local development stays indexable, as it always was, and serves the open
// `robots.txt` that production serves once the cut-over lets it be indexed
// (docs/specs/base-layout.md, "The open robots.txt allows the public site and
// excludes what is not relevant (v2)"). An unknown or missing ENVIRONMENT
// counts as deployed.
import { localityPath, type LocalityRef } from "../core/locality/paths.ts";

export const ROBOTS_HEADER = "X-Robots-Tag";
export const NOINDEX = "noindex";

/** Where the sitemap lives (src/pages/sitemap.xml.ts). */
export const SITEMAP_PATH = "/sitemap.xml";

/** Whether the environment must keep search engines out. Fails closed. */
export function blocksIndexing(environment: string | undefined): boolean {
  return environment !== "local";
}

/**
 * Adds `X-Robots-Tag: noindex` to a Worker response when the environment
 * blocks indexing. A response that already carries the header keeps its own
 * value, so the admin panel's stricter `noindex, nofollow` is never weakened.
 */
export function withRobotsPolicy(response: Response, environment: string | undefined): Response {
  if (!blocksIndexing(environment) || response.headers.has(ROBOTS_HEADER)) return response;
  try {
    response.headers.set(ROBOTS_HEADER, NOINDEX);
    return response;
  } catch {
    // The headers of some responses are immutable; copy it instead.
    const copy = new Response(response.body, response);
    copy.headers.set(ROBOTS_HEADER, NOINDEX);
    return copy;
  }
}

/** The `robots.txt` of an environment that blocks indexing: the whole site is closed. */
export const CLOSED_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

/** Paths of the site root that no crawler needs: the admin panel. */
export const SITE_DISALLOW: readonly string[] = ["/admin"];

/**
 * The pages of a locality no crawler needs, as segments under
 * `/{estado}/{municipio}/` (`*` stands for any text, RFC 9309): the search
 * results, which already ask not to be indexed; the report form of every card
 * and its thank-you page; and the registration thank-you page. Never the edit
 * mode (`/editar/<token>`): announcing where the secret links live would be
 * worse than leaving it out.
 */
export const LOCALITY_DISALLOW: readonly (readonly string[])[] = [
  ["buscar"],
  ["negocio", "*", "reportar"],
  ["reportar", "gracias"],
  ["registro", "gracias"],
];

/**
 * The open `robots.txt`: every page may be crawled except the panel and, for
 * each active locality, the pages of LOCALITY_DISALLOW; and it points to the
 * sitemap, unless the environment has no base for absolute URLs (null).
 */
export function openRobotsTxt(
  localities: readonly LocalityRef[],
  sitemapUrl: string | null,
): string {
  const disallowed = [
    ...SITE_DISALLOW,
    ...localities.flatMap((locality) =>
      LOCALITY_DISALLOW.map((segments) => localityPath(locality, ...segments)),
    ),
  ];
  const rules = ["User-agent: *", ...disallowed.map((path) => `Disallow: ${path}`)].join("\n");
  return sitemapUrl === null ? `${rules}\n` : `${rules}\n\nSitemap: ${sitemapUrl}\n`;
}
