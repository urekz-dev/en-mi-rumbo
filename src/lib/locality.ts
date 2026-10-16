// The locality of a public route (ADR 0007). Every page of a locality lives
// under src/pages/[state]/[municipality]/, so its URL is
// `/{estado}/{municipio}/...`. src/middleware.ts runs gateLocalityRequest on
// every request: for those routes it resolves the active locality before the
// page runs, stores it in `locals.locality` and answers 404, with the site's
// 404 page, when the state or the municipality is unknown, does not match, or
// has no active locality. Other routes (`/`, `/admin`, `/health`,
// `/robots.txt`, Astro's own) pass through untouched.
//
// The root (src/pages/index.astro) redirects with the helpers at the end of
// this file and remembers the visitor's choice in the locality cookie.
import type { ServedLocality } from "../core/locality/served.ts";

/** The route pattern of a locality's home, the prefix of all its pages. */
export const LOCALITY_ROUTE = "/[state]/[municipality]";

/** Whether Astro routed the request to a page of a locality. */
export function isLocalityRoute(routePattern: string): boolean {
  return routePattern === LOCALITY_ROUTE || routePattern.startsWith(`${LOCALITY_ROUTE}/`);
}

/**
 * An empty 404: Astro answers it with the site's 404 page
 * (src/pages/404.astro), the same as an address that matches no route.
 */
export function notFound(): Response {
  return new Response(null, { status: 404 });
}

/** Finds the active locality at `/{stateSlug}/{municipalitySlug}`, or null. */
export type FindLocality = (
  stateSlug: string,
  municipalitySlug: string,
) => Promise<ServedLocality | null>;

export interface LocalityGateContext {
  routePattern: string;
  params: Record<string, string | undefined>;
  locals: { locality?: ServedLocality };
}

export async function gateLocalityRequest(
  context: LocalityGateContext,
  next: () => Promise<Response>,
  find: FindLocality,
): Promise<Response> {
  if (!isLocalityRoute(context.routePattern)) return next();
  const { state, municipality } = context.params;
  const locality = state && municipality ? await find(state, municipality) : null;
  if (!locality) return notFound();
  context.locals.locality = locality;
  return next();
}

/**
 * The locality of the current page. Only pages under
 * src/pages/[state]/[municipality]/ may call it: the middleware has always
 * resolved it for them, so a missing one is a programming error.
 */
export function requireLocality(locals: { locality?: ServedLocality }): ServedLocality {
  if (!locals.locality) {
    throw new Error("requireLocality: this page is not under /[state]/[municipality]/");
  }
  return locals.locality;
}

/**
 * A 301 to a path of this site that browsers keep for an hour at most: for
 * `/` while one locality is active, and for a card asked for with an
 * outdated readable part. Browsers keep a 301 with no cache headers forever,
 * and where both lead can change (`/` when another locality is activated, a
 * card when its business is renamed), so a stale one must expire. It never
 * depends on the visitor: a redirect that does is a temporaryRedirect.
 */
export function permanentRedirect(path: string): Response {
  return new Response(null, {
    status: 301,
    headers: { Location: path, "Cache-Control": "max-age=3600" },
  });
}

/**
 * A 302 to a path of this site that no browser or cache keeps, for `/` with
 * two or more active localities: where it sends a visitor depends on their
 * own cookie and changes as soon as they choose another locality, so it is
 * never permanent and never stored (`Cache-Control: no-store`).
 */
export function temporaryRedirect(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/**
 * The cookie that remembers the locality a visitor chose from the list
 * (docs/specs/public-directory.md, "The chosen locality is remembered in a
 * cookie that holds only its slug (v2)"). Its value is the municipality slug
 * and nothing else; the privacy notice lists it.
 */
export const LOCALITY_COOKIE = "locality";

/** How long the choice is kept: a year, renewed each time the visitor chooses. */
export const LOCALITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface LocalityCookieOptions {
  path: "/";
  maxAge: number;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
}

/**
 * The attributes of the locality cookie: the whole site (`/` reads it), a
 * year, unreadable by scripts, sent when a visitor arrives from a link on
 * another site (`SameSite=Lax`, so a link shared on WhatsApp still honours
 * the choice), and `Secure` whenever the site is served over HTTPS.
 */
export function localityCookieOptions(url: URL): LocalityCookieOptions {
  return {
    path: "/",
    maxAge: LOCALITY_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
  };
}
