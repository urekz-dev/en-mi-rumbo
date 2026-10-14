// The public paths of a locality (ADR 0007; docs/specs/public-directory.md,
// "Public URLs carry the state and the municipality (v2)"). Every public page
// of a locality lives under `/{estado}/{municipio}`, both read from the
// locality record, so every internal link and every absolute URL starts here.
import type { ServedLocality } from "./served.ts";

/** What a path needs from a locality: its slug and its state's slug. */
export type LocalityRef = Pick<ServedLocality, "slug"> & {
  state: Pick<ServedLocality["state"], "slug">;
};

/**
 * The path of a page of `locality`, without a trailing slash: its home with
 * no segments (`/hidalgo/tizayuca`), or the page the segments name
 * (`localityPath(tizayuca, "negocio", "<slug>-<id>")` is
 * `/hidalgo/tizayuca/negocio/<slug>-<id>`). Each segment is URL-encoded, so a
 * slash inside one cannot add a level.
 */
export function localityPath(locality: LocalityRef, ...segments: string[]): string {
  return [locality.state.slug, locality.slug, ...segments]
    .map((segment) => `/${encodeURIComponent(segment)}`)
    .join("");
}
