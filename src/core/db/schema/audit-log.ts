// The admin audit log (docs/specs/data-model.md): one entry per destructive
// or irreversible admin action. It records the card's status before the
// action and never a copy of the card's data, so it holds no personal data of
// the business and outlives the card: `business_id` has no foreign key.
import { sql } from "drizzle-orm";
import { bigint, char, check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { BUSINESS_STATUSES } from "./business.ts";
import { oneOf } from "./checks.ts";
import { localities } from "./locality.ts";

export const AUDIT_ACTIONS = ["reject", "unpublish", "delete", "purge", "edit_contact"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The actor of the entries the scheduled job writes, such as a purge. */
export const SCHEDULED_JOB_ACTOR = "scheduled-job";

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localityCode: char("locality_code", { length: 5 })
      .notNull()
      .references(() => localities.code),
    businessId: text("business_id").notNull(),
    // The Access email of the admin, or SCHEDULED_JOB_ACTOR.
    actor: text("actor").notNull(),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    previousStatus: text("previous_status", { enum: BUSINESS_STATUSES }).notNull(),
  },
  (t) => [
    check("admin_audit_log_action_check", oneOf(t.action, AUDIT_ACTIONS)),
    check("admin_audit_log_previous_status_check", oneOf(t.previousStatus, BUSINESS_STATUSES)),
    check("admin_audit_log_actor_check", sql`btrim(${t.actor}) <> ''`),
    index("admin_audit_log_locality_occurred_idx").on(t.localityCode, t.occurredAt),
    index("admin_audit_log_business_idx").on(t.businessId),
  ],
);
