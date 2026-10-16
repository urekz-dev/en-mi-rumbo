// The URL of a business's card (docs/specs/public-directory.md, "Business card
// at its own URL with the registered information and the verified seal" and
// "An outdated card URL redirects to its current URL (v2)"; ADR 0007):
// `/{estado}/{municipio}/negocio/<slug>-<id>`. The identifier, the ten
// characters after the last hyphen, is what finds the card; the readable part
// is the business's current name as a slug, there so that a link pasted in a
// WhatsApp says what it leads to. A link with an earlier name still finds the
// card, and the page redirects it to the current URL.
import { localityPath, type LocalityRef } from "../locality/paths.ts";
import { isBusinessId } from "./id.ts";

/** The segment of the cards under a locality: `/{estado}/{municipio}/negocio/…`. */
export const CARD_SEGMENT = "negocio";

/**
 * The readable part of a card's URL: the name in lowercase ASCII words joined
 * by hyphens, without accents (`ñ` becomes `n`), with everything else dropped.
 * A name with nothing left (only symbols or emoji) gives an empty slug.
 */
export function businessSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The last segment of a card's URL, `<slug>-<id>`, or the identifier alone
 * when the name leaves no slug. The identifier has no hyphen, so it is always
 * what follows the last one.
 */
export function cardSegment(card: { name: string; id: string }): string {
  const slug = businessSlug(card.name);
  return slug === "" ? card.id : `${slug}-${card.id}`;
}

/**
 * The identifier a card segment names, or null when its last part is not one
 * (wrong length, a character outside the alphabet, capitals): such a segment
 * never reaches the database.
 */
export function cardIdOf(segment: string): string | null {
  const id = segment.slice(segment.lastIndexOf("-") + 1);
  return isBusinessId(id) ? id : null;
}

/** The path of a card of `locality`: `/hidalgo/tizayuca/negocio/<slug>-<id>`. */
export function cardPath(locality: LocalityRef, card: { name: string; id: string }): string {
  return localityPath(locality, CARD_SEGMENT, cardSegment(card));
}
