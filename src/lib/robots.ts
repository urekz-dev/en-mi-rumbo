// What search engines may index, per environment (ADR 0008). Every deployed
// environment, production included, stays out of search results until the
// cut-over: each Worker response carries `X-Robots-Tag: noindex` and
// `/robots.txt` closes the whole site. Static assets, such as the prerendered
// legal pages, never reach the Worker: the build gives them the same header
// through `_headers`, by the same rule (src/integrations/static-noindex.ts).
// Local development stays indexable, as it always was. An unknown or missing
// ENVIRONMENT counts as deployed.

export const ROBOTS_HEADER = "X-Robots-Tag";
export const NOINDEX = "noindex";

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

/** The body of `/robots.txt`: closed while the environment blocks indexing. */
export function robotsTxt(environment: string | undefined): string {
  if (blocksIndexing(environment)) return "User-agent: *\nDisallow: /\n";
  // Local: the public site is crawlable and the admin panel is not. The
  // sitemap line arrives with the sitemap.
  return "User-agent: *\nDisallow: /admin\n";
}
