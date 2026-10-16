// A second, fictitious active locality for the end-to-end tests of the list
// of localities (playwright.config.ts, the "two localities" projects). The
// database holds only the reference data of Tizayuca, so the locality brings
// its own state and municipality, with a code above the 32 that INEGI gives
// the states, like the fixtures of the workers tests; the setup creates it
// after the other end-to-end tests have run with Tizayuca alone, and the
// teardown removes it. Never in a migration or the seed.
import { eq } from "drizzle-orm";
import { localities, municipalities, states } from "../../../src/core/db/schema/index.ts";
import { withDatabase } from "../database.ts";

export const SECOND_LOCALITY = {
  code: "90001",
  name: "Pueblo de Prueba",
  slug: "pueblo-de-prueba",
  state: { code: "90", name: "Estado de prueba 90", slug: "estado-de-prueba-90" },
  /** A made-up seat, about 330 km north-west of Tizayuca's. */
  seat: { latitude: 21, longitude: -101 },
} as const;

/** Creates the second locality, active, or turns it on again. */
export function addSecondLocality(): Promise<void> {
  const { code, name, slug, state } = SECOND_LOCALITY;
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.insert(states).values(state).onConflictDoNothing();
      await tx
        .insert(municipalities)
        .values({ code, stateCode: state.code, name, slug })
        .onConflictDoNothing();
      await tx
        .insert(localities)
        .values({ code, timeZone: "America/Mexico_City", contactWhatsapp: "7719990190" })
        .onConflictDoNothing();
      await tx
        .update(localities)
        .set({ active: true, ...SECOND_LOCALITY.seat })
        .where(eq(localities.code, code));
    });
  });
}

/** Gives the second locality its seat back, or takes its coordinates away. */
export function setSecondLocalitySeat(placed: boolean): Promise<void> {
  const seat = placed ? SECOND_LOCALITY.seat : { latitude: null, longitude: null };
  return withDatabase(async (db) => {
    await db.update(localities).set(seat).where(eq(localities.code, SECOND_LOCALITY.code));
  });
}

/** Removes everything addSecondLocality created. */
export function removeSecondLocality(): Promise<void> {
  const { code, state } = SECOND_LOCALITY;
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.delete(localities).where(eq(localities.code, code));
      await tx.delete(municipalities).where(eq(municipalities.code, code));
      await tx.delete(states).where(eq(states.code, state.code));
    });
  });
}
