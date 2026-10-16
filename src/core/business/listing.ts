// What a listing card shows (docs/specs/public-directory.md, "The listing card
// brings the essentials and WhatsApp without extra taps"), and nothing else:
// the listings by category, by trade and by trade and zone, and the search
// results, all render src/components/ListingCard.astro from this shape.

export interface ListingBusiness {
  id: string;
  name: string;
  /** The business's own category, for the placeholder and the analytics event. */
  categorySlug: string;
  /** The catalogue zone, or the free text of "Otra"; null when there is neither. */
  zoneName: string | null;
  /** Null when the zone is "Otra" pending normalization. */
  zoneSlug: string | null;
  homeDelivery: boolean;
  whatsapp: string;
  /**
   * The stored photo reference, uninterpreted. Only the photo module (ADR
   * 0011, epic D) may turn it into an address; until then no surface
   * renders it.
   */
  photoKey: string | null;
}
