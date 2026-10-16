// The links that take a resident out of the site to contact a business
// (docs/specs/public-directory.md, "Contact buttons on the card with WhatsApp
// as the main action" and "The prefilled WhatsApp message names the directory
// with the current brand"): WhatsApp, a call, Google Maps and the page the
// business registered; and "Perdí mi enlace", which takes its owner to the
// admins of its locality. They are built here, not in the markup, so their
// rules (normalize the number, invent no address, never promise Facebook)
// are tested without rendering a page. The markup gives every link that opens a
// new tab `rel="noopener noreferrer"`; a `tel:` link opens none.
import type { ServedLocality } from "../locality/served.ts";

/**
 * The message every WhatsApp button toward a business opens with, written
 * once for every surface. It names the brand alone and no place: the business
 * already knows where it is (founder's resolution of 2026-09-04).
 */
export const WHATSAPP_MESSAGE = "Hola, te vi en enmirumbo. ¿Me das informes?";

/** The country codes dropped when ten digits remain without them. */
const COUNTRY_PREFIXES = ["521", "52"] as const;

/**
 * A Mexican number in its national form of ten digits, or null when the text
 * is not one. Spaces, hyphens, dots, brackets and `+` are dropped, and the
 * country code `52` or `521` when ten digits remain without it.
 */
export function nationalNumber(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  for (const prefix of COUNTRY_PREFIXES) {
    if (digits.length === prefix.length + 10 && digits.startsWith(prefix)) {
      return digits.slice(prefix.length);
    }
  }
  return null;
}

/** The conversation with the business, the message already written; null without a number. */
export function whatsappLink(whatsapp: string): string | null {
  const digits = nationalNumber(whatsapp);
  if (digits === null) return null;
  return `https://wa.me/52${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

/**
 * The message "Perdí mi enlace" writes in the conversation with the admins of
 * the card's locality (public-directory, ""Perdí mi enlace" button on the
 * card, toward the admin's WhatsApp"). The owner sends it from the number
 * they registered, so the admin can check that the card is theirs.
 */
export function lostLinkMessage(businessName: string): string {
  return (
    `Hola, soy de «${businessName}» en enmirumbo y perdí el enlace para editar mi ficha. ` +
    "Les escribo desde el número que registré, ¿me lo pueden pasar?"
  );
}

/**
 * "Perdí mi enlace": the conversation with the contact WhatsApp of the card's
 * locality, read from its record and never a global number (public-directory,
 * ""Perdí mi enlace" opens WhatsApp to the admin of the card's locality
 * (v2)"), with lostLinkMessage already written; null when that number is not
 * ten national digits, and then the card shows no "¿Es tu negocio?" at all.
 */
export function lostLinkLink(contactWhatsapp: string, businessName: string): string | null {
  const digits = nationalNumber(contactWhatsapp);
  if (digits === null) return null;
  return `https://wa.me/52${digits}?text=${encodeURIComponent(lostLinkMessage(businessName))}`;
}

/**
 * A call to the landline, `tel:+52…`, or null when what the business wrote is
 * not a number of ten national digits: the card then shows the text, and no
 * hostile dialing code ever reaches a `tel:` link.
 */
export function callLink(landline: string | null): string | null {
  if (landline === null) return null;
  const digits = nationalNumber(landline);
  return digits === null ? null : `tel:+52${digits}`;
}

/** What directions need of the locality: its name and its state's, from the record. */
export type DirectionsLocality = Pick<ServedLocality, "name"> & {
  state: Pick<ServedLocality["state"], "name">;
};

/**
 * A Google Maps search for the address or references the business wrote,
 * followed by its zone and the locality ("a un lado de la primaria, Huicalco,
 * Tizayuca, Hidalgo"), or null when it wrote none: no address is ever
 * invented, and the pin is not used.
 */
export function directionsLink(
  address: string | null,
  zoneName: string | null,
  locality: DirectionsLocality,
): string | null {
  const reference = address?.trim();
  if (!reference) return null;
  const parts = [reference, zoneName?.trim(), `${locality.name}, ${locality.state.name}`].filter(
    (part): part is string => Boolean(part),
  );
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

/** The page a business registered, and the real domain it leads to. */
export interface RegisteredPage {
  href: string;
  /** The hostname, without `www.`: the card shows it instead of promising Facebook. */
  domain: string;
}

/** The page the business registered, or null when it is not an http(s) URL. */
export function registeredPage(url: string | null): RegisteredPage | null {
  if (url === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return { href: parsed.href, domain: parsed.hostname.replace(/^www\./, "") };
}
