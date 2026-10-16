-- Custom migration (ADR 0006, amended on 2026-10-15): the database keeps only
-- the reference data of the localities the directory serves, today Tizayuca:
-- the state of Hidalgo (13), the municipality of Tizayuca (13069), its
-- locality and its zones. By decision of the product owner (2026-10-14) the
-- directory works only in Tizayuca and cities are added one at a time, on
-- purpose, each in its own data migration; how a new city's data is prepared
-- is decided when one is needed, so no script for INEGI's or SEPOMEX's
-- catalogues stays in the repository.
--
-- 0003 loaded INEGI's complete catalogue (32 states, 2,478 municipalities) and
-- never changes. This migration removes the rest of it, so a new database and
-- an existing one end the same. Only localities reference municipalities, and
-- only municipalities reference states; zones, businesses, the audit log and
-- role assignments reference localities. A municipality with a locality, and a
-- state that keeps a municipality, are left alone, so no foreign key can stop
-- the deletes. Every environment has one locality, Tizayuca, so Hidalgo and
-- Tizayuca are all that remains.
-- destructive-ok: deletes the states and municipalities that no locality uses, reference data removed on purpose by decision of the product owner (2026-10-14)
DELETE FROM "municipalities" AS m
WHERE m."code" <> '13069'
  AND NOT EXISTS (SELECT 1 FROM "localities" AS l WHERE l."code" = m."code");
--> statement-breakpoint
DELETE FROM "states" AS s
WHERE s."code" <> '13'
  AND NOT EXISTS (SELECT 1 FROM "municipalities" AS m WHERE m."state_code" = s."code");
