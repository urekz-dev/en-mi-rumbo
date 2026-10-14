CREATE TABLE "localities" (
	"code" char(5) PRIMARY KEY NOT NULL,
	"time_zone" text NOT NULL,
	"contact_whatsapp" text,
	"daily_registration_threshold" integer,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "localities_time_zone_check" CHECK (btrim("localities"."time_zone") <> ''),
	CONSTRAINT "localities_contact_whatsapp_check" CHECK ("localities"."contact_whatsapp" ~ '^[0-9]{10}$'),
	CONSTRAINT "localities_active_contact_check" CHECK (NOT "localities"."active" OR "localities"."contact_whatsapp" IS NOT NULL),
	CONSTRAINT "localities_daily_registration_threshold_check" CHECK ("localities"."daily_registration_threshold" IS NULL OR "localities"."daily_registration_threshold" > 0)
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"code" char(5) PRIMARY KEY NOT NULL,
	"state_code" char(2) NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "municipalities_state_slug_unique" UNIQUE("state_code","slug"),
	CONSTRAINT "municipalities_code_check" CHECK ("municipalities"."code" ~ '^[0-9]{5}$' AND left("municipalities"."code", 2) = "municipalities"."state_code"),
	CONSTRAINT "municipalities_slug_check" CHECK ("municipalities"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "states" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "states_slug_unique" UNIQUE("slug"),
	CONSTRAINT "states_code_check" CHECK ("states"."code" ~ '^[0-9]{2}$'),
	CONSTRAINT "states_slug_check" CHECK ("states"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"locality_code" char(5) NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "zones_locality_slug_unique" UNIQUE("locality_code","slug"),
	CONSTRAINT "zones_id_locality_unique" UNIQUE("id","locality_code"),
	CONSTRAINT "zones_type_check" CHECK (btrim("zones"."type") <> ''),
	CONSTRAINT "zones_name_check" CHECK (btrim("zones"."name") <> ''),
	CONSTRAINT "zones_slug_check" CHECK ("zones"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_check" CHECK ("categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trades_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "trades_name_unique" UNIQUE("name"),
	CONSTRAINT "trades_slug_unique" UNIQUE("slug"),
	CONSTRAINT "trades_slug_check" CHECK ("trades"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "business_trades" (
	"business_id" text NOT NULL,
	"trade_id" integer NOT NULL,
	CONSTRAINT "business_trades_pk" PRIMARY KEY("business_id","trade_id")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"locality_code" char(5) NOT NULL,
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"whatsapp" text NOT NULL,
	"zone_id" integer,
	"zone_other" text,
	"consented_to_notice_at" timestamp with time zone NOT NULL,
	"consented_to_notice_version" text,
	"reconsented_to_notice_at" timestamp with time zone,
	"reconsented_to_notice_version" text,
	"what_you_offer" text,
	"home_delivery" boolean DEFAULT false NOT NULL,
	"landline" text,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"opening_hours" text,
	"facebook_url" text,
	"photo_key" text,
	"name_normalized" text DEFAULT '' NOT NULL,
	"what_you_offer_normalized" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'in_review' NOT NULL,
	"origin" text DEFAULT 'organic' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"unpublished_at" timestamp with time zone,
	"unpublish_reason" text,
	"management_token_hash" text,
	"management_token_created_at" timestamp with time zone,
	CONSTRAINT "businesses_photo_key_unique" UNIQUE("photo_key"),
	CONSTRAINT "businesses_management_token_hash_unique" UNIQUE("management_token_hash"),
	CONSTRAINT "businesses_locality_whatsapp_unique" UNIQUE("locality_code","whatsapp"),
	CONSTRAINT "businesses_id_locality_unique" UNIQUE("id","locality_code"),
	CONSTRAINT "businesses_id_check" CHECK ("businesses"."id" ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{10}$'),
	CONSTRAINT "businesses_status_check" CHECK ("businesses"."status" IN ('in_review', 'published', 'rejected')),
	CONSTRAINT "businesses_origin_check" CHECK ("businesses"."origin" IN ('seeded', 'organic')),
	CONSTRAINT "businesses_whatsapp_check" CHECK ("businesses"."whatsapp" ~ '^[0-9]{10}$'),
	CONSTRAINT "businesses_zone_check" CHECK ("businesses"."zone_id" IS NOT NULL OR "businesses"."zone_other" IS NOT NULL),
	CONSTRAINT "businesses_reconsent_check" CHECK (("businesses"."reconsented_to_notice_at" IS NULL) = ("businesses"."reconsented_to_notice_version" IS NULL)),
	CONSTRAINT "businesses_pin_check" CHECK (("businesses"."latitude" IS NULL) = ("businesses"."longitude" IS NULL) AND ("businesses"."latitude" IS NULL OR ("businesses"."latitude" BETWEEN -90 AND 90 AND "businesses"."longitude" BETWEEN -180 AND 180))),
	CONSTRAINT "businesses_photo_key_check" CHECK ("businesses"."photo_key" ~ '^[A-Za-z0-9_-]+$'),
	CONSTRAINT "businesses_rejection_check" CHECK (("businesses"."rejected_at" IS NULL) = ("businesses"."rejection_reason" IS NULL) AND ("businesses"."rejected_at" IS NULL OR "businesses"."status" = 'rejected')),
	CONSTRAINT "businesses_unpublish_check" CHECK (("businesses"."unpublished_at" IS NULL) = ("businesses"."unpublish_reason" IS NULL)),
	CONSTRAINT "businesses_management_token_check" CHECK (("businesses"."management_token_hash" IS NULL) = ("businesses"."management_token_created_at" IS NULL) AND "businesses"."management_token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "pending_edits" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pending_edits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_id" text NOT NULL,
	"locality_code" char(5) NOT NULL,
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"whatsapp" text NOT NULL,
	"zone_id" integer,
	"zone_other" text,
	"what_you_offer" text,
	"home_delivery" boolean DEFAULT false NOT NULL,
	"landline" text,
	"address" text,
	"opening_hours" text,
	"facebook_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"discard_reason" text,
	CONSTRAINT "pending_edits_status_check" CHECK ("pending_edits"."status" IN ('pending', 'applied', 'discarded', 'superseded')),
	CONSTRAINT "pending_edits_whatsapp_check" CHECK ("pending_edits"."whatsapp" ~ '^[0-9]{10}$'),
	CONSTRAINT "pending_edits_zone_check" CHECK ("pending_edits"."zone_id" IS NOT NULL OR "pending_edits"."zone_other" IS NOT NULL),
	CONSTRAINT "pending_edits_resolution_check" CHECK (("pending_edits"."status" = 'pending') = ("pending_edits"."resolved_at" IS NULL) AND ("pending_edits"."discard_reason" IS NULL OR "pending_edits"."status" = 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_id" text NOT NULL,
	"locality_code" char(5) NOT NULL,
	"reason" text NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attended_at" timestamp with time zone,
	CONSTRAINT "reports_reason_check" CHECK ("reports"."reason" IN ('closed', 'not_real', 'incorrect_data', 'inappropriate')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" IN ('pending', 'attended')),
	CONSTRAINT "reports_attended_check" CHECK (("reports"."status" = 'attended') = ("reports"."attended_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locality_code" char(5) NOT NULL,
	"business_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"previous_status" text NOT NULL,
	CONSTRAINT "admin_audit_log_action_check" CHECK ("admin_audit_log"."action" IN ('reject', 'unpublish', 'delete', 'purge', 'edit_contact')),
	CONSTRAINT "admin_audit_log_previous_status_check" CHECK ("admin_audit_log"."previous_status" IN ('in_review', 'published', 'rejected')),
	CONSTRAINT "admin_audit_log_actor_check" CHECK (btrim("admin_audit_log"."actor") <> '')
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "permissions_key_check" CHECK ("permissions"."key" ~ '^[a-z_]+(\.[a-z_]+)+$')
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "role_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"role_scope" text NOT NULL,
	"locality_code" char(5),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignments_unique" UNIQUE NULLS NOT DISTINCT("user_id","role_id","locality_code"),
	CONSTRAINT "role_assignments_scope_check" CHECK (("role_assignments"."role_scope" = 'global') = ("role_assignments"."locality_code" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" text NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"all_permissions" boolean DEFAULT false NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key"),
	CONSTRAINT "roles_id_scope_unique" UNIQUE("id","scope"),
	CONSTRAINT "roles_key_check" CHECK ("roles"."key" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "roles_name_check" CHECK (btrim("roles"."name") <> ''),
	CONSTRAINT "roles_scope_check" CHECK ("roles"."scope" IN ('global', 'locality'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_check" CHECK ("users"."email" = lower(btrim("users"."email")) AND "users"."email" ~ '^[^@\s]+@[^@\s]+$'),
	CONSTRAINT "users_name_check" CHECK (btrim("users"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "localities" ADD CONSTRAINT "localities_code_municipalities_code_fk" FOREIGN KEY ("code") REFERENCES "public"."municipalities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_locality_code_localities_code_fk" FOREIGN KEY ("locality_code") REFERENCES "public"."localities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trades" ADD CONSTRAINT "business_trades_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trades" ADD CONSTRAINT "business_trades_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_locality_code_localities_code_fk" FOREIGN KEY ("locality_code") REFERENCES "public"."localities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_zone_fk" FOREIGN KEY ("zone_id","locality_code") REFERENCES "public"."zones"("id","locality_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_edits" ADD CONSTRAINT "pending_edits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_edits" ADD CONSTRAINT "pending_edits_business_fk" FOREIGN KEY ("business_id","locality_code") REFERENCES "public"."businesses"("id","locality_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_edits" ADD CONSTRAINT "pending_edits_zone_fk" FOREIGN KEY ("zone_id","locality_code") REFERENCES "public"."zones"("id","locality_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_business_fk" FOREIGN KEY ("business_id","locality_code") REFERENCES "public"."businesses"("id","locality_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_locality_code_localities_code_fk" FOREIGN KEY ("locality_code") REFERENCES "public"."localities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_locality_code_localities_code_fk" FOREIGN KEY ("locality_code") REFERENCES "public"."localities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_fk" FOREIGN KEY ("role_id","role_scope") REFERENCES "public"."roles"("id","scope") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_trades_trade_idx" ON "business_trades" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "businesses_locality_status_idx" ON "businesses" USING btree ("locality_code","status");--> statement-breakpoint
CREATE INDEX "businesses_category_idx" ON "businesses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "businesses_zone_idx" ON "businesses" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_edits_one_pending_idx" ON "pending_edits" USING btree ("business_id") WHERE "pending_edits"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "pending_edits_status_created_idx" ON "pending_edits" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pending_edits_business_status_idx" ON "pending_edits" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "reports_business_status_created_idx" ON "reports" USING btree ("business_id","status","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_locality_occurred_idx" ON "admin_audit_log" USING btree ("locality_code","occurred_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_business_idx" ON "admin_audit_log" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "role_assignments_locality_idx" ON "role_assignments" USING btree ("locality_code");