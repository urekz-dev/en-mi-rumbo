# enmirumbo

A hyperlocal business directory, starting in Tizayuca, Hidalgo. Businesses register from a phone, a person verifies each one before it is published, and residents contact them through WhatsApp.

This repository is being rebuilt from scratch. The code is public for reading only; see [LICENSE](LICENSE). External contributions are not accepted; see [CONTRIBUTING.md](CONTRIBUTING.md).

- Product: [docs/PRD.md](docs/PRD.md)
- Specifications: [docs/specs/](docs/specs/)
- Decisions: [docs/adr/](docs/adr/)

## Stack

- [Astro](https://astro.build/) in server mode on Cloudflare Workers, through `@astrojs/cloudflare`. A custom Worker entry (`src/worker.ts`) sends requests to Astro and also handles the scheduled jobs.
- Tailwind CSS 4.
- [Vite+](https://viteplus.dev/) (`vp`) as the toolchain: pnpm, Oxlint, Oxfmt, Vitest and Vite Task. Prettier formats `.astro` files until Oxfmt supports them.
- PostgreSQL 18 (Neon in the cloud, Docker locally) through Hyperdrive, with the `pg` driver and Drizzle ORM and Drizzle Kit.
- Tests run inside workerd with `@cloudflare/vitest-plugin`; end-to-end tests use Playwright.

## Requirements

- [Vite+](https://viteplus.dev/guide/) installed globally. It provides Node.js 24 and pnpm 12, the versions declared in `package.json`.
- Git 2.32 or later.
- [Docker](https://www.docker.com/) with Compose, for the local database.

## Run locally

```sh
vp install                           # dependencies and the pre-commit hook
vp exec playwright install chromium  # once, for the end-to-end tests
vp run dev                           # http://localhost:4321
```

The dev server, the build and the preview run Astro in workerd, the Workers runtime. Astro's commands are tasks: `vp dev`, `vp build` and `vp preview` run plain Vite and do not work in this project.

| Command            | What it does                                                                         |
| ------------------ | ------------------------------------------------------------------------------------ |
| `vp run dev`       | Starts the dev server at http://localhost:4321.                                      |
| `vp run build`     | Builds the site and the Worker into `dist/`.                                         |
| `vp run preview`   | Serves the build at http://localhost:4321.                                           |
| `vp check`         | Formats, lints and type checks.                                                      |
| `vp run check:all` | Runs `vp check`, Prettier on `.astro` files, `astro check` and a Worker types check. |
| `vp test`          | Runs the tests inside workerd.                                                       |
| `vp run e2e`       | Builds, then runs the Playwright tests against the preview.                          |
| `vp run fmt:astro` | Formats `.astro` files with Prettier.                                                |
| `vp run types`     | Regenerates `worker-configuration.d.ts` after a change to `wrangler.jsonc`.          |

### Admin panel

`/admin` is protected by Cloudflare Access ([ADR 0010](docs/adr/0010-admin-access-with-cloudflare-access.md)), and the Worker verifies the Access token on every request. Locally it opens without signing in, as `admin@enmirumbo.test`, because `wrangler.jsonc` sets `ENVIRONMENT` to `local`; that identity works only on `localhost`. The Worker variables that configure it (all of them are in [Deployment](#deployment)):

| Variable             | What it is                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| `ENVIRONMENT`        | `local`, `dev`, `stage` or `prod`. Any other value, or none, closes `/admin`. |
| `ACCESS_TEAM_DOMAIN` | The Access team domain, `urekz.cloudflareaccess.com`.                         |
| `ACCESS_AUD`         | The AUD tag of the `enmirumbo admin` Access application. Empty locally.       |

To run the scheduled handler while `vp run dev` is running:

```sh
curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=0+*+*+*+*"
```

## Database

PostgreSQL 18 runs in Docker for development and tests (`compose.yaml`; user, password and database are all `enmirumbo`, port 5432). The first start also creates a second database, `enmirumbo_test`, that `vp test` uses, so tests never touch development data.

```sh
vp run db:up        # start PostgreSQL and wait until it is healthy
vp run db:migrate   # apply the migrations in drizzle/ to the development database
vp run db:seed      # insert the fictitious seed data (safe to run again)
```

| Task                 | What it does                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `vp run db:up`       | Starts PostgreSQL 18 in Docker.                                                                    |
| `vp run db:down`     | Stops it. Data stays in the `enmirumbo-postgres-data` volume; `docker compose down -v` deletes it. |
| `vp run db:generate` | Generates a migration from `src/core/db/schema/`. Add `--custom --name=<name>` for plain SQL.      |
| `vp run db:migrate`  | Applies the migrations to `DATABASE_URL` (default: the local development database).                |
| `vp run db:seed`     | Runs the idempotent seed (`src/core/db/seed/`). Never runs when `ENVIRONMENT=prod`.                |
| `vp run db:check`    | Migration guard: fails on destructive SQL without a marker. `vp run check:all` runs it too.        |

- `DATABASE_URL` is a direct connection string used by Drizzle Kit, the seed and the test setup. A database that is not on this machine must use `sslmode=verify-full`; anything else is refused.
- The Worker reaches the database through two Hyperdrive bindings, both pointing at the local database in `wrangler.jsonc` (`localConnectionString`). Each deployed environment has its own pair (see [Deployment](#deployment)). `HYPERDRIVE` is cached and only for public reads; `HYPERDRIVE_FRESH` is for everything else. `withDb` in `src/core/db/client.ts` opens a client per request and closes it with `ctx.waitUntil`.
- `vp test` applies the migrations to `DATABASE_URL`, or to `enmirumbo_test` when it is unset, then runs the workers tests against that database. CI provides PostgreSQL 18 on `localhost:5432` and sets `DATABASE_URL`.
- Migrations are additive only. A destructive statement (`DROP`, `RENAME`, `ALTER ... TYPE`, `SET NOT NULL`, `TRUNCATE`) is allowed only in a file that carries the line `-- destructive-ok: <reason>`, and lands in its own pull request, one version after the code stopped using the column or table.
- The first migration enables the `pg_trgm` and `unaccent` extensions.

## Deployment

Three deployed environments ([ADR 0008](docs/adr/0008-environments-and-deployment-flow.md)), each a Wrangler environment in `wrangler.jsonc` with its own Worker, bindings and variables. The top level of `wrangler.jsonc` is the local Worker, `enmirumbo-local`, which is never deployed.

| Environment | Worker            | URL                                       | Deployed by                                         | Database (Neon branch)    | Cron Trigger |
| ----------- | ----------------- | ----------------------------------------- | --------------------------------------------------- | ------------------------- | ------------ |
| `dev`       | `dev-enmirumbo`   | https://dev-enmirumbo.urekz.workers.dev   | `deploy-dev.yml`, by hand from any branch           | `dev`, reset from `stage` | none         |
| `stage`     | `stage-enmirumbo` | https://stage-enmirumbo.urekz.workers.dev | `deploy-stage.yml`, on every push to `main`         | `stage`                   | hourly       |
| `prod`      | `enmirumbo`       | https://enmirumbo.urekz.workers.dev       | `deploy-prod.yml`, on a tag `vX.Y.Z` (with Release) | `prod`                    | hourly       |

Every deployed environment answers with `X-Robots-Tag: noindex` and a closed `robots.txt` until the cut-over, production included. Version and Preview URLs are off, so `/admin` is reachable only through Access.

Each workflow checks the ref, builds for its environment, checks the generated configuration (`scripts/deploy/check-build.sh`), applies the migrations, seeds (not on `prod`), deploys with the project's Wrangler and runs a smoke test (`scripts/deploy/smoke-test.sh`). The dev workflow first resets the Neon `dev` branch from `stage` (`scripts/deploy/reset-neon-dev.sh`), so anything stored in dev is lost on each deploy. Each step receives only the secrets it needs from the GitHub Environment of the same name (see [Secrets](#secrets)). To deploy a branch to dev: Actions, "Deploy dev", "Run workflow", pick the branch. To release: push a tag `vX.Y.Z` from `main`.

The build fixes the environment: `CLOUDFLARE_ENV=<env> vp run build` writes `dist/server/wrangler.json` for that environment only, and `wrangler deploy` refuses to deploy it to another one. Never run `wrangler deploy` by hand.

Worker variables:

| Variable             | What it is                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`        | `local`, `dev`, `stage` or `prod`. Any other value, or none, closes `/admin` and asks not to index. |
| `ACCESS_TEAM_DOMAIN` | The Access team domain, `urekz.cloudflareaccess.com`.                                               |
| `ACCESS_AUD`         | The AUD tag of the `enmirumbo admin` Access application. While it is empty, `/admin` answers 403.   |
| `SITE_URL`           | The public URL of the environment, without a trailing slash: the base of every absolute URL.        |
| `DEPLOY_BRANCH`      | `dev` only: the branch deployed, set by `deploy-dev.yml` and shown in the page footer.              |
| `DEPLOY_COMMIT`      | `dev` only: the commit deployed, set by `deploy-dev.yml` and shown in the page footer.              |

The Hyperdrive configurations hold the database credentials and are created by hand, two per environment: `enmirumbo-<env>` (cached) and `enmirumbo-<env>-fresh` (caching disabled), both on the direct (non-pooled) host of that environment's Neon branch. Their ids go in `wrangler.jsonc`; while an id is a placeholder, the deploy of that environment stops before changing anything.

## Secrets

Every secret lives in the GitHub Environments of this repository, `dev`, `stage` and `prod`, plus `backup` for the nightly backup ([ADR 0020](docs/adr/0020-secrets-in-github-environments.md)): Settings > Environments. A secret reaches only the jobs that declare its environment; `prod` releases its secrets only to tags `v*`, and `stage` and `backup` only to `main`. GitHub masks their values in the logs and never shows them again, so the originals stay in each provider and in the custodian's password manager.

| Secret                  | Environments                     | What it is                                                                                                                                                                |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `dev`, `stage`, `prod`           | An account API token with the Editor role on that environment's Worker only.                                                                                              |
| `CLOUDFLARE_ACCOUNT_ID` | `dev`, `stage`, `prod`, `backup` | The Cloudflare account id.                                                                                                                                                |
| `DATABASE_URL`          | `dev`, `stage`, `prod`, `backup` | The direct (non-pooled) connection string of that environment's Neon branch, `sslmode=verify-full`. In `backup`, production's, for the read-only role `enmirumbo_backup`. |
| `NEON_API_KEY`          | `dev`                            | A Neon project-scoped API key, to reset the `dev` branch from `stage`.                                                                                                    |
| `NEON_PROJECT_ID`       | `dev`                            | The Neon project id.                                                                                                                                                      |
| `R2_ACCESS_KEY_ID`      | `backup`                         | The Access Key ID of an R2 token with Object Read & Write on the `enmirumbo-backups` bucket only.                                                                         |
| `R2_SECRET_ACCESS_KEY`  | `backup`                         | The Secret Access Key of that token.                                                                                                                                      |

The Worker has no secrets yet. When one arrives, its name goes in `secrets.required` of each Wrangler environment, its value in the GitHub Environments, and the deploy step uploads it with `wrangler deploy --secrets-file`. Changing a secret takes a new deploy of that environment. Locally no real secret is needed; a `.dev.vars` file, ignored by git, holds any local value.

## Operations

### Availability check

`monitor.yml` requests the home page of production and `/health` at minutes 7 and 37 of every hour ([ADR 0016](docs/adr/0016-ci-cd-monitoring-and-backups.md)). `/health` answers 200 `ok` only when the Worker reaches the database (`SELECT 1` through `HYPERDRIVE_FRESH`), and 503 `unavailable` otherwise. Each check is tried three times, 20 seconds apart, before the run fails, and the run names every check that failed. GitHub emails a failed run to the person who last changed the workflow's schedule.

When it fails: open the run to see which check failed, look at the live logs of the `enmirumbo` Worker in the Cloudflare dashboard (the health route logs why the database did not answer), and at the `prod` branch in the Neon console. To check again by hand: Actions, "Monitor prod", "Run workflow".

Every check wakes production's Neon compute, which then stays up about five minutes: up to about 30 of the 100 compute-unit hours a month of Neon's free plan.

### Backups

`backup.yml` runs every night at 03:23 Mexico City time, from `main`, with the secrets of the `backup` environment. It dumps production with `pg_dump` 18 in the custom format, as the read-only role `enmirumbo_backup`, checks that the dump reads back and holds table data, and uploads it to the private R2 bucket `enmirumbo-backups` as `prod/enmirumbo-<UTC date and time>.dump`. The run summary names the object with its size and SHA-256, which is also stored in the object's metadata. To take a backup by hand: Actions, "Backup prod", "Run workflow".

The bucket has no public hostname. Its lifecycle rule deletes each dump after 30 days, and its bucket lock keeps each dump at least that long, so nobody can delete or overwrite one earlier, not even the backup's token. The R2 token has Object Read & Write on that bucket only.

`enmirumbo_backup` exists only on the production branch. It was created once in the Neon SQL Editor, as the role that runs the migrations (`enmirumbodb_owner`), so the default privileges cover every table and sequence the migrations add to `public` and `drizzle`. A new schema needs the same grants, or the backup fails:

```sql
CREATE ROLE enmirumbo_backup WITH LOGIN PASSWORD '<generated password>';
GRANT USAGE ON SCHEMA public, drizzle TO enmirumbo_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO enmirumbo_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO enmirumbo_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, drizzle GRANT SELECT ON TABLES TO enmirumbo_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, drizzle GRANT SELECT ON SEQUENCES TO enmirumbo_backup;
```

### Restore

In an incident, first use Neon's instant restore of the `prod` branch (Neon console, Branches, `prod`, Restore), which reaches 6 hours back on the free plan. For anything older, restore a dump. The steps below restore into `dev`, which is how the procedure is rehearsed; the next "Deploy dev" resets `dev` from `stage` again.

1. Download the dump: Cloudflare dashboard, R2, `enmirumbo-backups`, `prod/`, the object, Download. Compare `shasum -a 256 <file>` with the SHA-256 of its run summary.
2. Copy the direct connection string of the target branch from the Neon console (Connect, connection pooling off) and change `sslmode=require` to `sslmode=verify-full`. Keep it out of the shell history: run `read -rs TARGET_DATABASE_URL && export TARGET_DATABASE_URL`, paste it and press Enter.
3. Restore it with the PostgreSQL 18 client of the `postgres:18` image, from the folder that holds the dump. The image has no certificate authorities, so the machine's are mounted (`/etc/ssl/cert.pem` on macOS, `/etc/ssl/certs/ca-certificates.crt` on Debian and Ubuntu). It runs in a single transaction: on any error nothing changes.

   ```sh
   docker run --rm -e TARGET_DATABASE_URL -e PGSSLROOTCERT=/certs/ca.pem \
     -v /etc/ssl/cert.pem:/certs/ca.pem:ro -v "$PWD:/backup:ro" postgres:18 \
     sh -c 'pg_restore --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error --dbname "$TARGET_DATABASE_URL" /backup/<file>'
   ```

4. Check it: the migrations the dump knew are there.

   ```sh
   docker run --rm -e TARGET_DATABASE_URL -e PGSSLROOTCERT=/certs/ca.pem \
     -v /etc/ssl/cert.pem:/certs/ca.pem:ro postgres:18 \
     sh -c 'psql "$TARGET_DATABASE_URL" -c "SELECT count(*) FROM drizzle.__drizzle_migrations"'
   ```

5. On `dev`, run "Deploy dev" afterwards. On `prod`, take a backup by hand first, so the broken state is kept too, then restore and run the availability check.
