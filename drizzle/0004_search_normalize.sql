-- Custom migration (docs/specs/data-model.md, "The database derives the
-- normalized name and "¿Qué ofreces?" of a business for the search (v2)"):
-- the search normalization in SQL, the counterpart of `normalizeText` in
-- src/core/search/normalize.ts, which normalizes what a resident types.
-- test/worker/search.test.ts compares both. Lowercase, without accents, with
-- everything that is not a-z or 0-9 turned into one space, trimmed.
--
-- `unaccent` is only STABLE, because its dictionary could change, so a
-- generated column cannot call it. This function names the dictionary
-- explicitly and is declared IMMUTABLE: the dictionary of the extension does
-- not change while the database runs, and a new dictionary would come with a
-- migration that recomputes the columns.
CREATE FUNCTION "search_normalize"(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN btrim(regexp_replace(lower(public.unaccent('public.unaccent'::regdictionary, $1)), '[^a-z0-9]+', ' ', 'g'));
