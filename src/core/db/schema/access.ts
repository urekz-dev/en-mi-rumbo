// Who can do what in the admin panel (ADR 0021). Cloudflare Access verifies
// the email; these tables decide what that email can do. A role bundles
// permissions and has a scope: a global role applies everywhere, a locality
// role applies to the locality of each assignment. Roles are data: a super
// admin creates and edits them. The base roles and the permission catalogue
// come from the migrations; a system role (`super_admin`) cannot be changed or
// deleted, which a trigger enforces.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { matches, oneOf } from "./checks.ts";
import { localities } from "./locality.ts";

export const ROLE_SCOPES = ["global", "locality"] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * A person who can use the admin panel, identified by the email that
 * Cloudflare Access verifies. The email is stored lowercase. A user without an
 * active role assignment can open nothing.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "users_email_check",
      sql`${t.email} = lower(btrim(${t.email})) AND ${matches(t.email, "^[^@\\s]+@[^@\\s]+$")}`,
    ),
    check("users_name_check", sql`btrim(${t.name}) <> ''`),
  ],
);

/** The permission catalogue, the same as PERMISSIONS in src/core/access. */
export const permissions = pgTable(
  "permissions",
  {
    key: text("key").primaryKey(),
    description: text("description").notNull(),
  },
  (t) => [check("permissions_key_check", matches(t.key, "^[a-z_]+(\\.[a-z_]+)+$"))],
);

export const roles = pgTable(
  "roles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    scope: text("scope", { enum: ROLE_SCOPES }).notNull(),
    // Created by a migration; cannot be updated or deleted.
    system: boolean("system").notNull().default(false),
    // Holds every permission, including the ones added later.
    allPermissions: boolean("all_permissions").notNull().default(false),
  },
  (t) => [
    // Target of the composite foreign key that keeps an assignment's
    // locality consistent with its role's scope.
    unique("roles_id_scope_unique").on(t.id, t.scope),
    check("roles_key_check", matches(t.key, "^[a-z][a-z0-9_]*$")),
    check("roles_name_check", sql`btrim(${t.name}) <> ''`),
    check("roles_scope_check", oneOf(t.scope, ROLE_SCOPES)),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ name: "role_permissions_pk", columns: [t.roleId, t.permissionKey] })],
);

/**
 * A role given to a user: everywhere when the role is global, in one locality
 * when it is a locality role. A role that is assigned cannot be deleted.
 */
export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id").notNull(),
    roleScope: text("role_scope", { enum: ROLE_SCOPES }).notNull(),
    localityCode: char("locality_code", { length: 5 }).references(() => localities.code),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "role_assignments_role_fk",
      columns: [t.roleId, t.roleScope],
      foreignColumns: [roles.id, roles.scope],
    }).onUpdate("cascade"),
    unique("role_assignments_unique").on(t.userId, t.roleId, t.localityCode).nullsNotDistinct(),
    check(
      "role_assignments_scope_check",
      sql`(${t.roleScope} = 'global') = (${t.localityCode} IS NULL)`,
    ),
    index("role_assignments_locality_idx").on(t.localityCode),
  ],
);
