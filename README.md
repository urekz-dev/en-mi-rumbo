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

| Task                 | What it does                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `vp run db:up`       | Starts PostgreSQL 18 in Docker.                                                               |
| `vp run db:down`     | Stops it. Data stays in the `enmirumbo-pgdata` volume; `docker compose down -v` deletes it.   |
| `vp run db:generate` | Generates a migration from `src/core/db/schema/`. Add `--custom --name=<name>` for plain SQL. |
| `vp run db:migrate`  | Applies the migrations to `DATABASE_URL` (default: the local development database).           |
| `vp run db:seed`     | Runs the idempotent seed (`src/core/db/seed/`). Never runs when `ENVIRONMENT=prod`.           |
| `vp run db:check`    | Migration guard: fails on destructive SQL without a marker. `vp run check:all` runs it too.   |

- `DATABASE_URL` is a direct connection string used by Drizzle Kit, the seed and the test setup. A database that is not on this machine must use `sslmode=verify-full`; anything else is refused.
- The Worker reaches the database through two Hyperdrive bindings, both pointing at the local database in `wrangler.jsonc` (`localConnectionString`). The real ids per environment arrive with the deployment stories. `HYPERDRIVE` is cached and only for public reads; `HYPERDRIVE_FRESH` is for everything else. `withDb` in `src/core/db/client.ts` opens a client per request and closes it with `ctx.waitUntil`.
- `vp test` applies the migrations to `DATABASE_URL`, or to `enmirumbo_test` when it is unset, then runs the workers tests against that database. CI provides PostgreSQL 18 on `localhost:5432` and sets `DATABASE_URL`.
- Migrations are additive only. A destructive statement (`DROP`, `RENAME`, `ALTER ... TYPE`, `SET NOT NULL`, `TRUNCATE`) is allowed only in a file that carries the line `-- destructive-ok: <reason>`, and lands in its own pull request, one version after the code stopped using the column or table.
- The first migration enables the `pg_trgm` and `unaccent` extensions.

Deployment to Cloudflare arrives with the stories that add the environments and the workflows, and this README will describe it then.
