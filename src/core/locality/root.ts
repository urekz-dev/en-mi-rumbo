// What the site root and the short alias do, from the active localities (ADR
// 0007; docs/specs/public-directory.md, "While there is one active locality,
// the root and the alias redirect to it (v2)" and "With two or more active
// localities the root lists them and never redirects by location (v2)").
// Pure: the pages read the active localities and act on the answer.
import { isSlug, type ServedLocality } from "./served.ts";

export type RootDestination =
  /** Exactly one active locality: `/` answers a 301 to its home. */
  | { kind: "locality"; locality: ServedLocality }
  /** Two or more: `/` lists them (EMR-29 builds the list). */
  | { kind: "list"; localities: readonly ServedLocality[] }
  /** None: `/` says the directory is coming, with a 200. */
  | { kind: "none" };

export function rootDestination(active: readonly ServedLocality[]): RootDestination {
  const [only] = active;
  if (active.length === 1 && only) return { kind: "locality", locality: only };
  if (active.length > 1) return { kind: "list", localities: active };
  return { kind: "none" };
}

/**
 * The locality the short alias `/{segment}` redirects to: while exactly one
 * locality is active, `segment` is its municipality slug (`/tizayuca` for
 * Tizayuca), so printed material keeps working. Null otherwise, and the alias
 * answers 404. With two or more active localities no alias redirects, because
 * the specification only covers a single one.
 */
export function aliasDestination(
  active: readonly ServedLocality[],
  segment: string,
): ServedLocality | null {
  const destination = rootDestination(active);
  if (destination.kind !== "locality" || !isSlug(segment)) return null;
  return destination.locality.slug === segment ? destination.locality : null;
}
