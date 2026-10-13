-- Custom migration: extensions used by search (trigram similarity and accent-insensitive matching).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
