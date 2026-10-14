// Scenarios of docs/specs/data-model.md, requirement "Panel users, roles and
// permissions live in the database (v2)" (ADR 0021): the permission catalogue
// matches the code, the base roles, the protection of system roles, the scope
// of assignments and the permissions a user ends up with.
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { PERMISSIONS } from "../../src/core/access/permissions.ts";
import { can, permissionsOf } from "../../src/core/access/queries.ts";
import {
  permissions,
  roleAssignments,
  rolePermissions,
  roles,
  users,
} from "../../src/core/db/schema/index.ts";
import { cleanup, createFixture, db, type Fixture, PG, pgErrorCode } from "./fixtures.ts";

const STATE = "97";
const DOMAIN = "@acceso.enmirumbo.test";
let f: Fixture;

async function removeTestData(): Promise<void> {
  await db(async (tx) => {
    await tx.delete(users).where(like(users.email, `%${DOMAIN}`));
    await tx.delete(roles).where(like(roles.key, "test_%"));
  });
  await cleanup(STATE);
}

beforeAll(async () => {
  await removeTestData();
  f = await createFixture(STATE);
});

afterAll(removeTestData);

const roleId = async (key: string) =>
  db(async (tx) => (await tx.select().from(roles).where(eq(roles.key, key)))[0]!);

async function createUser(name: string, active = true): Promise<{ id: string; email: string }> {
  const email = `${name}${DOMAIN}`;
  const [row] = await db((tx) =>
    tx.insert(users).values({ email, name, active }).returning({ id: users.id }),
  );
  return { id: row!.id, email };
}

async function assign(userId: string, key: string, localityCode: string | null): Promise<void> {
  const role = await roleId(key);
  await db((tx) =>
    tx
      .insert(roleAssignments)
      .values({ userId, roleId: role.id, roleScope: role.scope, localityCode }),
  );
}

const INTEGRITY = "23000";

describe("Panel users, roles and permissions live in the database (v2)", () => {
  it("the permission catalogue of the database is the one the code checks", async () => {
    const rows = await db((tx) => tx.select().from(permissions));
    expect(Object.fromEntries(rows.map((row) => [row.key, row.description]))).toEqual(PERMISSIONS);
  });

  it("the base roles come from the migrations", async () => {
    expect(await roleId("super_admin")).toMatchObject({
      scope: "global",
      system: true,
      allPermissions: true,
    });
    const localityAdmin = await roleId("locality_admin");
    expect(localityAdmin).toMatchObject({
      scope: "locality",
      system: false,
      allPermissions: false,
    });
    const granted = await db((tx) =>
      tx.select().from(rolePermissions).where(eq(rolePermissions.roleId, localityAdmin.id)),
    );
    expect(granted.map((g) => g.permissionKey).sort()).toEqual(
      [
        "audit_log.view",
        "businesses.delete",
        "businesses.edit",
        "businesses.review",
        "businesses.unpublish",
        "edits.review",
        "links.manage",
        "reports.manage",
        "zones.manage",
      ].sort(),
    );
  });

  it("a system role cannot be changed, deleted or given permission rows", async () => {
    const superAdmin = await roleId("super_admin");
    expect(
      await pgErrorCode(() =>
        db((tx) => tx.update(roles).set({ name: "Otro" }).where(eq(roles.id, superAdmin.id))),
      ),
    ).toBe(INTEGRITY);
    expect(
      await pgErrorCode(() => db((tx) => tx.delete(roles).where(eq(roles.id, superAdmin.id)))),
    ).toBe(INTEGRITY);
    expect(
      await pgErrorCode(() =>
        db((tx) =>
          tx
            .insert(rolePermissions)
            .values({ roleId: superAdmin.id, permissionKey: "users.manage" }),
        ),
      ),
    ).toBe(INTEGRITY);
  });

  it("a role created as data grants exactly its permissions", async () => {
    const [reviewer] = await db((tx) =>
      tx
        .insert(roles)
        .values({ key: "test_reviewer", name: "Revisor de prueba", scope: "locality" })
        .returning(),
    );
    await db((tx) =>
      tx
        .insert(rolePermissions)
        .values({ roleId: reviewer!.id, permissionKey: "businesses.review" }),
    );
    const user = await createUser("revisor");
    await assign(user.id, "test_reviewer", f.localityA);

    const granted = await db((tx) => permissionsOf(tx, user.email, f.localityA));
    expect([...granted]).toEqual(["businesses.review"]);
  });

  it("a super admin may do everything, everywhere", async () => {
    const user = await createUser("fundador");
    await assign(user.id, "super_admin", null);

    for (const locality of [f.localityA, f.localityB, null]) {
      const granted = await db((tx) => permissionsOf(tx, user.email, locality));
      expect([...granted].sort()).toEqual(Object.keys(PERMISSIONS).sort());
    }
  });

  it("a locality admin may act only in the localities assigned", async () => {
    const user = await createUser("admin-ciudad");
    await assign(user.id, "locality_admin", f.localityA);

    expect(await db((tx) => can(tx, user.email, "businesses.delete", f.localityA))).toBe(true);
    expect(await db((tx) => can(tx, user.email, "businesses.delete", f.localityB))).toBe(false);
    // Managing users is not about one locality: only a global role grants it.
    expect(await db((tx) => can(tx, user.email, "users.manage", null))).toBe(false);
    expect(await db((tx) => can(tx, user.email, "localities.manage", f.localityA))).toBe(false);
  });

  it("an inactive user, or one without assignments, may do nothing", async () => {
    const inactive = await createUser("inactivo", false);
    await assign(inactive.id, "super_admin", null);
    const unassigned = await createUser("sin-rol");

    for (const user of [inactive, unassigned]) {
      expect((await db((tx) => permissionsOf(tx, user.email, f.localityA))).size).toBe(0);
    }
  });

  it("the email is matched without regard to case or spaces", async () => {
    const user = await createUser("mayusculas");
    await assign(user.id, "locality_admin", f.localityA);
    const shouted = ` ${user.email.toUpperCase()} `;
    expect(await db((tx) => can(tx, shouted, "businesses.review", f.localityA))).toBe(true);
  });

  it("an assignment carries a locality exactly when its role is a locality role", async () => {
    const user = await createUser("alcance");
    expect(await pgErrorCode(() => assign(user.id, "locality_admin", null))).toBe(PG.check);
    expect(await pgErrorCode(() => assign(user.id, "super_admin", f.localityA))).toBe(PG.check);
  });

  it("the same role is not assigned twice in the same place, not even globally", async () => {
    const user = await createUser("doble");
    await assign(user.id, "super_admin", null);
    expect(await pgErrorCode(() => assign(user.id, "super_admin", null))).toBe(PG.unique);
    await assign(user.id, "locality_admin", f.localityA);
    await assign(user.id, "locality_admin", f.localityB);
    expect(await pgErrorCode(() => assign(user.id, "locality_admin", f.localityA))).toBe(PG.unique);
  });

  it("a role in use cannot be deleted or change its scope; deleting a user takes its assignments", async () => {
    const [role] = await db((tx) =>
      tx
        .insert(roles)
        .values({ key: "test_temporal", name: "Temporal", scope: "locality" })
        .returning(),
    );
    const user = await createUser("temporal");
    await assign(user.id, "test_temporal", f.localityA);

    expect(
      await pgErrorCode(() => db((tx) => tx.delete(roles).where(eq(roles.id, role!.id)))),
    ).toBe(PG.foreignKey);
    expect(
      await pgErrorCode(() =>
        db((tx) => tx.update(roles).set({ scope: "global" }).where(eq(roles.id, role!.id))),
      ),
    ).toBe(PG.check);

    await db((tx) => tx.delete(users).where(eq(users.id, user.id)));
    const left = await db((tx) => tx.$count(roleAssignments, eq(roleAssignments.userId, user.id)));
    expect(left).toBe(0);
    await db((tx) => tx.delete(roles).where(eq(roles.id, role!.id)));
  });

  it("emails are stored lowercase and are unique", async () => {
    expect(
      await pgErrorCode(() =>
        db((tx) => tx.insert(users).values({ email: `Mayus${DOMAIN}`, name: "Mayus" })),
      ),
    ).toBe(PG.check);
    const user = await createUser("unico");
    expect(
      await pgErrorCode(() =>
        db((tx) => tx.insert(users).values({ email: user.email, name: "Otro" })),
      ),
    ).toBe(PG.unique);
  });
});
