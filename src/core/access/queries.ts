// What a user may do (ADR 0021): the permissions of the user's active role
// assignments that apply where the action happens. A global assignment applies
// everywhere; a locality assignment applies only in its locality. An action
// that is not about one locality (managing users or roles) is checked with
// `locality: null`, so only global assignments grant it.
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { permissions, roleAssignments, rolePermissions, roles, users } from "../db/schema/index.ts";
import type { Permission } from "./permissions.ts";

export async function permissionsOf(
  db: Db,
  email: string,
  locality: string | null,
): Promise<Set<Permission>> {
  const where = and(
    eq(users.email, email.trim().toLowerCase()),
    eq(users.active, true),
    locality === null
      ? isNull(roleAssignments.localityCode)
      : or(isNull(roleAssignments.localityCode), eq(roleAssignments.localityCode, locality)),
  );
  const rows = await db
    .selectDistinct({ key: permissions.key })
    .from(users)
    .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(
      permissions,
      sql`${roles.allPermissions} OR ${permissions.key} = ${rolePermissions.permissionKey}`,
    )
    .where(where);
  return new Set(rows.map((row) => row.key as Permission));
}

/** Whether a user may do `permission` in `locality` (null: not about one). */
export async function can(
  db: Db,
  email: string,
  permission: Permission,
  locality: string | null,
): Promise<boolean> {
  return (await permissionsOf(db, email, locality)).has(permission);
}
