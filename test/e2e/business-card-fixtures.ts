// What the end-to-end tests of the card add to the seeded database
// (business-card.spec.ts), and remove afterwards: a published card of another,
// fictitious locality, which must not answer under Tizayuca, and a pending
// edit of a seeded card, which must not show through. The other locality
// brings its own state, with a code above the 32 that INEGI gives the states,
// and stays inactive, so no other test sees it. Never in a migration or the
// seed. Numbers follow the 771999xxxx convention.
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../src/core/db/schema/index.ts";
import {
  businesses,
  categories,
  localities,
  municipalities,
  pendingEdits,
  states,
} from "../../src/core/db/schema/index.ts";
import { withDatabase } from "./database.ts";

export const OTHER_LOCALITY = {
  code: "89001",
  name: "Pueblo Ajeno",
  slug: "pueblo-ajeno",
  state: { code: "89", name: "Estado de prueba 89", slug: "estado-de-prueba-89" },
} as const;

/** A published card of the other locality. */
export const OTHER_CARD = {
  id: "zz89zz89zz",
  name: "Herrería Ajena de Mentiras",
  segment: "herreria-ajena-de-mentiras-zz89zz89zz",
} as const;

/** The id of a category of the migrations, by its slug. */
async function categoryId(
  db: Pick<NodePgDatabase<typeof schema>, "select">,
  slug: string,
): Promise<number> {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug));
  if (!category) throw new Error(`e2e: no category ${slug}; are the migrations applied?`);
  return category.id;
}

/** Creates the other locality, inactive, with its published card. */
export function addOtherLocalityCard(): Promise<void> {
  const { code, name, slug, state } = OTHER_LOCALITY;
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.insert(states).values(state).onConflictDoNothing();
      await tx
        .insert(municipalities)
        .values({ code, stateCode: state.code, name, slug })
        .onConflictDoNothing();
      await tx
        .insert(localities)
        .values({ code, timeZone: "America/Mexico_City" })
        .onConflictDoNothing();
      await tx
        .insert(businesses)
        .values({
          id: OTHER_CARD.id,
          localityCode: code,
          name: OTHER_CARD.name,
          categoryId: await categoryId(tx, "servicios-del-hogar"),
          whatsapp: "7719990189",
          zoneOther: "Colonia de mentiras",
          consentedToNoticeAt: new Date(),
          status: "published",
          publishedAt: new Date(),
        })
        .onConflictDoNothing();
    });
  });
}

/** Removes everything addOtherLocalityCard created. */
export function removeOtherLocalityCard(): Promise<void> {
  const { code, state } = OTHER_LOCALITY;
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.delete(businesses).where(eq(businesses.localityCode, code));
      await tx.delete(localities).where(eq(localities.code, code));
      await tx.delete(municipalities).where(eq(municipalities.code, code));
      await tx.delete(states).where(eq(states.code, state.code));
    });
  });
}

/** What a pending edit of a seeded card proposes: none of it may show. */
export const PROPOSED = {
  name: "Veterinaria Propuesta y Asociados",
  whatYouOffer: "Estética canina propuesta",
  openingHours: "Domingos propuestos de 1 a 2",
  landline: "7719990188",
  address: "Dirección propuesta de mentiras",
  facebookUrl: "https://propuesta.example/veterinaria",
  zoneOther: "Colonia propuesta",
} as const;

/** Gives the seeded card `businessId` of Tizayuca a pending edit, replacing any. */
export function addPendingEdit(businessId: string): Promise<void> {
  return withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.delete(pendingEdits).where(eq(pendingEdits.businessId, businessId));
      await tx.insert(pendingEdits).values({
        businessId,
        localityCode: "13069",
        categoryId: await categoryId(tx, "salud"),
        whatsapp: "7719990187",
        homeDelivery: true,
        ...PROPOSED,
      });
    });
  });
}

/** Removes the pending edits of `businessId`. */
export function removePendingEdits(businessId: string): Promise<void> {
  return withDatabase(async (db) => {
    await db.delete(pendingEdits).where(eq(pendingEdits.businessId, businessId));
  });
}
