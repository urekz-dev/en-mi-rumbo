// The name a zone is shown with on the public pages
// (docs/specs/public-directory.md, "A zone whose name repeats in its locality
// is shown with its settlement type (v2)"). SEPOMEX lists some names with two
// settlement types, so two zones of a locality may share a name ("El Carmen",
// a colonia and a fraccionamiento), and a zone may be named like its
// municipality ("Tizayuca", a unidad habitacional and a zona industrial). Such
// a zone is shown with its type: "El Carmen (Fraccionamiento)", "Tizayuca
// (Zona industrial)". Every other zone is shown with its name alone. Decided
// from the data, never from a list of names; slugs never change. Pure.
import { normalizeText } from "../search/normalize.ts";

/** What the name of a zone depends on. */
export interface TypedZone {
  slug: string;
  name: string;
  /** Its settlement type, as stored ("Colonia", "Zona industrial"). */
  type: string;
}

/** The display name of each zone of a locality, by slug. */
export type ZoneNames = ReadonlyMap<string, string>;

/** A settlement type as UI copy writes it: "ZONA INDUSTRIAL" → "Zona industrial". */
export function sentenceCase(text: string): string {
  const lower = text.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");
  return lower.charAt(0).toLocaleUpperCase("es-MX") + lower.slice(1);
}

/**
 * The display name of every zone of a locality, by slug: its name, followed
 * by its type in brackets when the name is another zone's of the locality or
 * the locality's own. Names are compared as the search compares words,
 * ignoring case, accents and punctuation. `zones` are all the zones of the
 * locality, hidden ones included, so hiding a zone never renames another.
 */
export function zoneDisplayNames(zones: readonly TypedZone[], localityName: string): ZoneNames {
  const sharing = new Map<string, number>();
  for (const { name } of zones) {
    const key = normalizeText(name);
    sharing.set(key, (sharing.get(key) ?? 0) + 1);
  }
  const locality = normalizeText(localityName);
  return new Map(
    zones.map(({ slug, name, type }) => {
      const key = normalizeText(name);
      const repeats = (sharing.get(key) ?? 0) > 1 || (key !== "" && key === locality);
      return [slug, repeats ? `${name.trim()} (${sentenceCase(type)})` : name.trim()];
    }),
  );
}

/** What shows a zone: its catalogue slug, or null for the free text of "Otra". */
export interface ShowsZone {
  zoneSlug: string | null;
  zoneName: string | null;
}

/**
 * `item` with the display name of its zone. The free text of a zone "Otra"
 * is no catalogue zone, and is shown as the business wrote it.
 */
export function withZoneName<Item extends ShowsZone>(item: Item, names: ZoneNames): Item {
  const name = item.zoneSlug === null ? undefined : names.get(item.zoneSlug);
  return name === undefined ? item : { ...item, zoneName: name };
}
