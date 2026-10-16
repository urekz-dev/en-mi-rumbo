// The slug rule of the reference data (docs/specs/data-model.md): the states,
// municipalities, zones, categories and trades take the slugs of their public
// URLs from their names. The data migrations hold the slugs; nothing under
// src/ derives one from a name, so the rule lives here, where the tests check
// the slugs the migrations wrote against it.
import { SLUG_PATTERN } from "../../src/core/db/schema/checks.ts";

const SLUG = new RegExp(SLUG_PATTERN);

/**
 * The slug of a name: lowercase ASCII words joined by hyphens, with the
 * accents removed (ñ becomes n) and the punctuation dropped. Throws on a
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
