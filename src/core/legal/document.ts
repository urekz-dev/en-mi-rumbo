// The shape of a legal page (docs/specs/legal-pages.md): its single h1, the
// last-update line, an introduction, the sections as h2 with their
// paragraphs, lists and links, and an optional closing link. The texts are
// data, so the pages only render them (src/components/LegalDocument.astro)
// and the guard of the privacy notice fingerprints what is published, not
// how the source or the markup is written (src/core/legal/version.ts).

/** The two legal pages, which live at the site root and belong to no locality. */
export const PRIVACY_NOTICE_PATH = "/aviso-de-privacidad";
export const TERMS_PATH = "/terminos";

/** Cloudflare's privacy addendum for Turnstile, which the notice must reference (ADR 0012). */
export const TURNSTILE_PRIVACY_ADDENDUM = "https://www.cloudflare.com/turnstile-privacy-policy/";

export type LegalHref =
  | typeof PRIVACY_NOTICE_PATH
  | typeof TERMS_PATH
  | typeof TURNSTILE_PRIVACY_ADDENDUM;

export interface LegalLink {
  text: string;
  href: LegalHref;
}

/** A paragraph, a bulleted list, or a link on a line of its own. */
export type LegalBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: readonly string[] }
  | ({ kind: "link" } & LegalLink);

export interface LegalSection {
  /** The text of the section's h2. */
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  /** The text of the page's single h1. */
  title: string;
  /** What follows "Última actualización: ". */
  lastUpdated: string;
  /** The paragraph before the first section. */
  introduction: string;
  sections: readonly LegalSection[];
  /** A link after the last section, outside any section. */
  closingLink?: LegalLink;
}

/** The title and description of a legal page, its own and not the site's. */
export interface LegalPageMetadata {
  title: string;
  description: string;
}

/** The last-update line as published, without the version the notice prepends. */
export function lastUpdatedLine(document: LegalDocument): string {
  return `Última actualización: ${document.lastUpdated}`;
}

/** Whether a link leaves the site (it then opens in a new tab). */
export function isExternal(href: LegalHref): boolean {
  return href.startsWith("https://");
}
