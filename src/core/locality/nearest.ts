// The nearest locality as a suggestion (ADR 0007; docs/specs/public-directory.md,
// "Geolocation is only a suggestion of the nearest locality (v2)"). Pure: the
// visitor's approximate location comes from the `cf` object Cloudflare
// attaches to each request, is used for this request only and is never
// stored or logged; nothing here keeps it. The localities are placed at their
// municipal seat (ServedLocality.seat). The list of localities highlights the
// answer and never redirects by it.

/** A point on the Earth, in decimal degrees. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** A coordinate as Cloudflare writes it, or null when it is missing or not a number in range. */
function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

/**
 * The visitor's approximate coordinates from Cloudflare's `cf` object
 * (`request.cf`, whose `latitude` and `longitude` are strings such as
 * "19.83780"), or null when the request carries none: some networks,
 * requests that do not come through Cloudflare.
 */
export function approximateLocation(cf: unknown): Coordinates | null {
  if (typeof cf !== "object" || cf === null) return null;
  const { latitude: lat, longitude: lon } = cf as { latitude?: unknown; longitude?: unknown };
  const latitude = coordinate(lat, 90);
  const longitude = coordinate(lon, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

/** Mean radius of the Earth, in kilometres. */
const EARTH_RADIUS_KM = 6371.0088;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The great-circle distance between two points, in kilometres (haversine formula). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLatitude = radians(b.latitude - a.latitude);
  const dLongitude = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The place nearest to `from`, among the places `locate` gives coordinates
 * for, or null: without a location there is no suggestion. On a tie the
 * first place in the list wins, so the answer never depends on anything
 * but the list and the location.
 */
export function nearest<T>(
  from: Coordinates | null,
  places: readonly T[],
  locate: (place: T) => Coordinates | null,
): T | null {
  if (from === null) return null;
  let best: { place: T; distance: number } | null = null;
  for (const place of places) {
    const at = locate(place);
    if (at === null) continue;
    const distance = distanceKm(from, at);
    if (best === null || distance < best.distance) best = { place, distance };
  }
  return best?.place ?? null;
}
