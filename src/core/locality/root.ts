// What the site root does, from the active localities and what the visitor's
// request carries (ADR 0007; docs/specs/public-directory.md, "While there is
// one active locality, the root redirects to it (v2)", "With two or more
// active localities the root lists them and never redirects by location
// (v2)", "The chosen locality is remembered in a cookie that holds only its
// slug (v2)" and "The pages of a locality offer to change municipality while
// two or more are active (v2)"). Pure: the root page reads the active
// localities, the cookie and the query, and acts on the answer. Public URLs
// have no short alias: only `/` decides anything.
import { nearest, type Coordinates } from "./nearest.ts";
import { isSlug, type ServedLocality } from "./served.ts";

/** What the root reads from the visitor's request. */
export interface RootRequest {
  /** The value of the locality cookie: the municipality slug the visitor chose. */
  chosen?: string | undefined;
  /** The value of `?elegir=`, `{estado}/{municipio}`: the visitor chooses that locality now. */
  choose?: string | null | undefined;
  /** Whether the request asks for the list to change locality (`?cambiar`). */
  changing?: boolean | undefined;
  /** The visitor's approximate location, for this answer only; never stored. */
  location?: Coordinates | null | undefined;
}

export type RootDestination =
  /** None active: `/` says the directory is coming, with a 200. */
  | { kind: "none" }
  /** Exactly one active: `/` answers a 301 to its home, whatever the request carries. */
  | { kind: "locality"; locality: ServedLocality }
  /** Two or more, and the visitor chose this one from the list: store it and go to its home. */
  | { kind: "choose"; locality: ServedLocality }
  /** Two or more, and the cookie names this one: go to its home. */
  | { kind: "chosen"; locality: ServedLocality }
  /**
   * Two or more, and nothing chosen: the list of localities, with the one
   * nearest to the visitor among those whose seat has coordinates, or null
   * without a location.
   */
  | { kind: "list"; localities: readonly ServedLocality[]; suggested: ServedLocality | null };

export function rootDestination(
  active: readonly ServedLocality[],
  request: RootRequest = {},
): RootDestination {
  const [only] = active;
  if (active.length === 0 || !only) return { kind: "none" };
  if (active.length === 1) return { kind: "locality", locality: only };
  const choice = choiceTarget(active, request.choose);
  if (choice) return { kind: "choose", locality: choice };
  const chosen = request.changing ? null : chosenLocality(active, request.chosen);
  if (chosen) return { kind: "chosen", locality: chosen };
  const suggested = nearest(request.location ?? null, active, (locality) => locality.seat);
  return { kind: "list", localities: active, suggested };
}

/**
 * The active locality the cookie names, or null. The cookie holds only a
 * municipality slug, which is unique within its state only: a value that is
 * not a slug, that names no active locality, or that names two (the same
 * municipality slug in two states) is ignored.
 */
export function chosenLocality(
  active: readonly ServedLocality[],
  value: string | undefined,
): ServedLocality | null {
  if (value === undefined || !isSlug(value)) return null;
  const named = active.filter((locality) => locality.slug === value);
  return named.length === 1 ? (named[0] ?? null) : null;
}

/**
 * The active locality that `?elegir={estado}/{municipio}` names, or null:
 * exactly two slugs, the state's and the municipality's, as `choicePath`
 * writes them (./paths.ts).
 */
export function choiceTarget(
  active: readonly ServedLocality[],
  value: string | null | undefined,
): ServedLocality | null {
  const [stateSlug, slug, ...rest] = (value ?? "").split("/");
  if (stateSlug === undefined || slug === undefined || rest.length > 0) return null;
  if (!isSlug(stateSlug) || !isSlug(slug)) return null;
  return (
    active.find((locality) => locality.state.slug === stateSlug && locality.slug === slug) ?? null
  );
}
