// A second, fictitious active locality for the end-to-end tests of the list
// of localities (playwright.config.ts, the "two localities" projects). It
// lives in a state above INEGI's 32, like the fixtures of the workers tests,
// so it never touches the catalogue; the setup creates it after the other
// end-to-end tests have run with Tizayuca alone, and the teardown removes it.
// Never in a migration or the seed. Only a database on this machine is
// accepted, the same one the global setup migrates and seeds.
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../../src/core/db/schema/index.ts";
import { isLocalConnectionString, LOCAL_DATABASE_URL } from "../../../src/core/db/url.ts";

const { localities, municipalities, states } = schema;

export const SECOND_LOCALITY = {
  code: "90001",
  name: "Pueblo de Prueba",
  slug: "pueblo-de-prueba",
  state: { code: "90", name: "Estado de prueba 90", slug: "estado-de-prueba-90" },
  /** A made-up seat, about 330 km north-west of Tizayuca's. */
  seat: { latitude: 21, longitude: -101 },
} as const;

async function withDatabase(run: (db: NodePgDatabase<typeof schema>) => Promise<void>) {
  const url = process.env["DATABASE_URL"] ?? LOCAL_DATABASE_URL;
  if (!isLocalConnectionString(url)) {
    throw new Error("e2e: DATABASE_URL is not a local database; the end-to-end tests change it.");
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await run(drizzle({ client, schema }));
  } finally {
    await client.end();
  }
}

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
