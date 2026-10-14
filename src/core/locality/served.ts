// The locality a public route serves (ADR 0006, ADR 0007). Every public route
// resolves `/{estado}/{municipio}` with `servedLocality` before anything else,
// and answers 404 when it returns null: an unknown state or municipality, a
// municipality under another state, one without a locality, or an inactive
// locality. Activating a locality is a data change, never a code change.
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { SLUG_PATTERN } from "../db/schema/checks.ts";
import { localities, municipalities, states } from "../db/schema/index.ts";

export interface ServedLocality {
  /** INEGI code of the municipality, such as `13069`. */
  code: string;
  name: string;
  slug: string;
  state: { code: string; name: string; slug: string };
  /** IANA time zone, such as `America/Mexico_City`. */
  timeZone: string;
  /** The public number of the locality's admins, the one "Perdí mi enlace" opens. */
  contactWhatsapp: string;
}

const SLUG = new RegExp(SLUG_PATTERN);

/**
 * The active locality at `/{stateSlug}/{municipalitySlug}`, or null. Slugs
 * match exactly; a segment that cannot be a slug never reaches the database.
 */
export async function servedLocality(
  db: Db,
  stateSlug: string,
  municipalitySlug: string,
): Promise<ServedLocality | null> {
  if (!SLUG.test(stateSlug) || !SLUG.test(municipalitySlug)) return null;
  const [row] = await db
    .select({
      code: localities.code,
      name: municipalities.name,
      slug: municipalities.slug,
      stateCode: states.code,
      stateName: states.name,
      stateSlug: states.slug,
      timeZone: localities.timeZone,
      contactWhatsapp: localities.contactWhatsapp,
    })
    .from(localities)
    .innerJoin(municipalities, eq(municipalities.code, localities.code))
    .innerJoin(states, eq(states.code, municipalities.stateCode))
    .where(
      and(
        eq(states.slug, stateSlug),
        eq(municipalities.slug, municipalitySlug),
        eq(localities.active, true),
      ),
    );
  // An active locality always has a contact WhatsApp (localities_active_contact_check).
  if (!row || row.contactWhatsapp === null) return null;
  return {
    code: row.code,
    name: row.name,
    slug: row.slug,
    state: { code: row.stateCode, name: row.stateName, slug: row.stateSlug },
    timeZone: row.timeZone,
    contactWhatsapp: row.contactWhatsapp,
  };
}
