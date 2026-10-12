# ADR 0005: PostgreSQL on Neon through Hyperdrive, with Drizzle

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

The founder wants PostgreSQL from day one and a data model ready for more localities, which rules out D1 (SQLite). Supabase pauses free projects after a week of inactivity. Neon's free plan offers 100 compute-hours per project per month, ten branches, scale-to-zero after five minutes with a cold start of a few hundred milliseconds, and PostgreSQL 18 by default. A Neon branch can be reset to its parent's current state while keeping its connection string; a branch with children cannot be reset. Workers reach PostgreSQL through Hyperdrive, which pools connections and caches read queries for 60 seconds by default without invalidating on writes; the free plan allows 10 configurations and 100,000 queries per day. Cloudflare recommends the `pg` driver with Drizzle.

## Decision

PostgreSQL 18 on Neon, one project with three branches chained `prod` → `stage` → `dev`, created while the database is empty so that no real data ever exists outside `prod`. Before every manual deploy to `dev`, CI resets `dev` from `stage`; `stage` is never reset.

Each environment has two Hyperdrive configurations on its branch, both pointing at Neon's direct (non-pooled) host: `HYPERDRIVE`, cached, used only for public reads; and `HYPERDRIVE_FRESH`, with caching disabled, used for writes, the admin panel, verification flows and any read that follows a write. That is six configurations. The Worker creates a new `pg` client per request and closes it with `ctx.waitUntil`. Drizzle is the ORM.

Drizzle Kit generates versioned SQL migrations that CI applies with `drizzle-kit migrate` over the direct connection string: to `dev` on each manual deploy, to `stage` on merge to `main`, to production before deploying a tag. Migrations are additive only: a column or table stops being used in one version and is dropped in a later one, so `wrangler rollback` is always compatible with the schema. A CI guard fails when a new migration file contains `DROP`, `RENAME`, a column type change or `SET NOT NULL`; an intentional destructive migration lands in its own pull request with the guard's override noted. The `pg_trgm` and `unaccent` extensions are enabled by a custom migration. Local development and CI use the `postgres:18` image, and Wrangler's local Hyperdrive connection string points both bindings at it.

## Consequences

Branches isolate environments without separate projects, and compute hours are shared, so non-production branches must scale to zero. The cold start after idle is accepted; if it hurts at launch, production moves to PlanetScale PS-5 (5 USD per month) without changing code. Choosing the right binding is a rule reviewers check: a public page that reads after a write in the same request uses `HYPERDRIVE_FRESH`. Backups are handled in ADR 0016.
