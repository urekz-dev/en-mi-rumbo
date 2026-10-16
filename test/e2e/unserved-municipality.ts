// A fictitious state with one municipality and no locality, for the
// end-to-end checks that a municipality the database holds but does not
// serve, or an active one under another state, answers 404
// (locality-routes.spec.ts). The database holds only the reference data of
// Tizayuca, so these tests bring their own state, with a code above the 32
// that INEGI gives the states, like the fixtures of the workers tests, and
// remove it afterwards. Never in a migration or the seed.
import { eq } from "drizzle-orm";
import { municipalities, states } from "../../src/core/db/schema/index.ts";
import { withDatabase } from "./database.ts";

export const UNSERVED = {
  code: "91001",
  name: "Pueblo Sin Localidad",
  slug: "pueblo-sin-localidad",
  state: { code: "91", name: "Estado de prueba 91", slug: "estado-de-prueba-91" },
} as const;

/** Creates the state and its municipality, without a locality. */
export function addUnservedMunicipality(): Promise<void> {
  const { code, name, slug, state } = UNSERVED;
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.insert(states).values(state).onConflictDoNothing();
      await tx
        .insert(municipalities)
        .values({ code, stateCode: state.code, name, slug })
        .onConflictDoNothing();
    });
  });
}

/** Removes everything addUnservedMunicipality created. */
export function removeUnservedMunicipality(): Promise<void> {
  const { code, state } = UNSERVED;
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.delete(municipalities).where(eq(municipalities.code, code));
      await tx.delete(states).where(eq(states.code, state.code));
    });
  });
}
