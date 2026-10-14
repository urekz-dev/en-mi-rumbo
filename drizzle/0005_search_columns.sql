-- The normalized search columns become columns the database generates with
-- `search_normalize` (drizzle/0004_search_normalize.sql), so that no write
-- path can leave them out of sync and no backfill is needed: PostgreSQL fills
-- them for every existing row when it adds them.
-- destructive-ok: the two columns were never written by any release and no code reads them; every environment has no businesses yet, and they come back at once as generated columns.
ALTER TABLE "businesses" ALTER COLUMN "name_normalized" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "businesses" drop column "name_normalized";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "name_normalized" text GENERATED ALWAYS AS (search_normalize("businesses"."name")) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "what_you_offer_normalized" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "businesses" drop column "what_you_offer_normalized";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "what_you_offer_normalized" text GENERATED ALWAYS AS (search_normalize(coalesce("businesses"."what_you_offer", ''))) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "businesses_name_normalized_trgm_idx" ON "businesses" USING gin ("name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "businesses_what_you_offer_normalized_trgm_idx" ON "businesses" USING gin ("what_you_offer_normalized" gin_trgm_ops);