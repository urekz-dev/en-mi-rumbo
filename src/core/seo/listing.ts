// The heading, title and description of each listing page
// (docs/specs/public-directory.md, "Category listing at a clean URL with the
// catalogue slug", "Indexable trade page at the root, generated from the
// closed catalogue", "Indexable trade and zone page" and "Own title and
// description on each directory page, with its canonical"). The `h1` of each
// page is also its title. The texts are the spec's, with the locality's name
// read from its record (base-layout, "Every text that names the locality
// reads it from the locality record (v2)"). Pure.
import type { CatalogueEntry } from "../catalogue/root-urls.ts";
import { tradePhrase } from "../catalogue/trade-phrases.ts";
import { type CardLocality, zoneInLocality } from "./card.ts";

/** What a listing's texts need: a heading, which is also its title, and a description. */
export interface ListingTexts {
  heading: string;
  description: string;
}

/** "«Categoría» en «Municipio»". */
export function categoryTexts(category: CatalogueEntry, locality: CardLocality): ListingTexts {
  const heading = `${category.name.trim()} en ${locality.name}`;
  return {
    heading,
    description: `${heading}: negocios de aquí, verificados uno por uno, que contactas directo por WhatsApp.`,
  };
}

/** "«Frase del giro» en «Municipio»". */
export function tradeTexts(trade: CatalogueEntry, locality: CardLocality): ListingTexts {
  const heading = `${tradePhrase(trade)} en ${locality.name}`;
  return {
    heading,
    description: `${heading}: negocios verificados que contactas directo por WhatsApp, sin intermediarios.`,
  };
}

/**
 * "«Frase del giro» en «Colonia», «Municipio»", without the municipality when
 * the zone's name already says it ("Plomería en Haciendas de Tizayuca").
 */
export function tradeZoneTexts(
  trade: CatalogueEntry,
  zone: CatalogueEntry,
  locality: CardLocality,
): ListingTexts {
  const phrase = tradePhrase(trade);
  return {
    heading: `${phrase} en ${zoneInLocality(zone.name, locality)}`,
    description: `${phrase} en ${zone.name.trim()}: negocios verificados de ${locality.name} que contactas directo por WhatsApp.`,
  };
}
