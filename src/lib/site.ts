// What the global layout says about the site (docs/specs/base-layout.md,
// "Server Component with a document in es-MX and base metadata"): the brand,
// the document title, the description and where "the start" is. Every text
// that names the locality reads it from the locality record (PRD §5); without
// a locality (the root, /admin, a 404 outside a locality) nothing names one.
import { localityPath, type LocalityRef } from "../core/locality/paths.ts";
import type { ServedLocality } from "../core/locality/served.ts";

/** The brand: one word, always lowercase, never with a locality attached. */
export const SITE_NAME = "enmirumbo";

type Named = Pick<ServedLocality, "name">;

/**
 * The document title. A page with its own title says first what it is about
 * and then whose it is ("Servicios del hogar en … — enmirumbo"); a page
 * without one takes the site title, whose geography lives in the descriptor.
 */
export function documentTitle(pageTitle: string | undefined, locality: Named | undefined): string {
  const own = pageTitle?.trim() ?? "";
  if (own !== "") return `${own} — ${SITE_NAME}`;
  if (locality === undefined) return SITE_NAME;
  return `${SITE_NAME} — Encuentra negocios y servicios en ${locality.name}`;
}

/**
 * The description of the site root (base-layout, "Pages outside a locality
 * name no locality (v2)"): it names no locality, since the root belongs to
 * none and lists them all once two or more are active.
 */
export const ROOT_DESCRIPTION =
  "Encuentra negocios, servicios y deporte de tu municipio y contáctalos directo por WhatsApp. " +
  "Registro gratis para negocios locales.";

/** The description of the site in a locality, or none outside a locality. */
export function siteDescription(locality: Named | undefined): string | undefined {
  if (locality === undefined) return undefined;
  return (
    `Encuentra negocios, servicios y deporte en ${locality.name} y contáctalos directo por ` +
    "WhatsApp. Registro gratis para negocios locales."
  );
}

/**
 * Where the wordmark and "Ir al inicio" lead: the home of the locality on its
 * routes (ADR 0007), and the root everywhere else, which takes the visitor to
 * a locality.
 */
export function homePath(locality: LocalityRef | undefined): string {
  return locality === undefined ? "/" : localityPath(locality);
}
