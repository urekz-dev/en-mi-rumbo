// The addresses of a report (docs/specs/public-directory.md, "Report mini-form
// without an account, with a closed-list reason and optional comment" and
// "The report form lands on its thank-you page (v2)"): the form of a card is
// `/{estado}/{municipio}/negocio/<slug>-<id>/reportar`, under the card, and
// its thank-you page is `/{estado}/{municipio}/reportar/gracias?negocio=<id>`.
// `reportar` is a reserved segment (src/core/catalogue/root-urls.ts), and
// robots.txt keeps both out of search engines (LOCALITY_DISALLOW,
// src/lib/robots.ts).
import { cardPath } from "../business/card-path.ts";
import { localityPath, type LocalityRef } from "../locality/paths.ts";

/** The last segment of a card's report form, and the first of its thank-you page. */
export const REPORT_SEGMENT = "reportar";

/** The segment of the thank-you page, under REPORT_SEGMENT. */
export const THANKS_SEGMENT = "gracias";

/** The parameter of the thank-you page that names the card reported. */
export const REPORTED_CARD_PARAM = "negocio";

/** The report form of a card: its current path, then `/reportar`. */
export function reportPath(locality: LocalityRef, card: { name: string; id: string }): string {
  return `${cardPath(locality, card)}/${REPORT_SEGMENT}`;
}

/** The thank-you page after reporting the card `id` of `locality`. */
export function reportThanksPath(locality: LocalityRef, id: string): string {
  const params = new URLSearchParams({ [REPORTED_CARD_PARAM]: id });
  return `${localityPath(locality, REPORT_SEGMENT, THANKS_SEGMENT)}?${params.toString()}`;
}
