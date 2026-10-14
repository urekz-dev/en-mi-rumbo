// The slug rule of the reference catalogues (docs/specs/data-model.md): INEGI's
// states and municipalities (inegi-catalogue.ts) and SEPOMEX's zones
// (sepomex-zones.ts) take the slugs of their public URLs from their names.
import { SLUG_PATTERN } from "../../src/core/db/schema/checks.ts";

const SLUG = new RegExp(SLUG_PATTERN);

/**
 * The slug of an official name: lowercase ASCII words joined by hyphens, with
 * the accents removed (ñ becomes n) and the punctuation dropped. Throws on a
 * letter it cannot write in ASCII instead of losing it.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\p{Pd}/gu, " ")
    .replace(/[\p{P}\p{S}]/gu, "")
    .trim()
    .split(/\s+/)
    .join("-");
  if (!SLUG.test(slug)) throw new Error(`no slug for "${name}" (got "${slug}")`);
  return slug;
}

/** Whether `slug` follows the slug rule, as the database checks it. */
export function isSlug(slug: string): boolean {
  return SLUG.test(slug);
}
