# ADR 0016: CI/CD, monitoring and backups with GitHub Actions

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

Workers Builds cannot run PostgreSQL or Playwright and has few concurrent builds on the free plan. The public repository has unlimited Actions minutes. The team's other repositories already use hardened workflows: read-only permissions by default, actions pinned by commit SHA, no untrusted input inline, actionlint and zizmor checks, Dependabot grouped weekly with a cooldown. Neon's free plan has a short restore window, Workers cannot run `pg_dump`, and `pg_dump` must be at least the server's major version.

## Decision

GitHub Actions for everything. One pull request pipeline: `vp run check:all`, unit and integration tests with a PostgreSQL service, the build, and Playwright. Three deploy workflows: manual to `dev` by branch (ADR 0008), automatic to `stage` on `main`, and tag to production with a GitHub Release and a smoke test. Each builds for its environment and deploys with the project's Wrangler, using an account API token that can create Workers and write Workers Routes on the enmirumbo.com zone; R2 buckets and Hyperdrive configurations are created once outside CI. A scheduled workflow every 30 minutes requests the home page and a health route of production and fails if either does not answer, which emails the team. A nightly workflow installs the PostgreSQL 18 client from the PGDG repository, runs `pg_dump -Fc` against production's direct connection string, and uploads the dump through R2's S3 API to a private bucket whose lifecycle rule deletes objects after 30 days; the R2 token is scoped to that bucket. All workflows follow the hardening above; each takes its credentials from its GitHub Environment (amended by ADR 0020).

Amended on 2026-10-13 (EMR-20):

- The backup runs from `main` in its own GitHub Environment, `backup`, because the `prod` environment only accepts tags. It holds the connection string of `enmirumbo_backup`, a role created with SQL on the production branch that can only read (`USAGE` and `SELECT` on the `public` and `drizzle` schemas), and an R2 token with Object Read & Write on the backup bucket only.
- The bucket, `enmirumbo-backups`, also has a bucket lock of 30 days, so nobody, not even that token, can delete or overwrite a dump before its lifecycle rule removes it. Dumps are not encrypted beyond R2's encryption at rest: most of their data is already public on the site, and a lost key would lose every backup.
- The health route is `/health`. It answers 200 when `SELECT 1` succeeds through `HYPERDRIVE_FRESH` and 503 otherwise, without details, and is never cached.
- GitHub emails a failed scheduled run only to the person who last changed its schedule. Alerting the whole team waits for the launch.

## Consequences

No external monitoring or backup vendor. Backups contain personal data and the bucket is private with no public hostname; access is through the Cloudflare account only. A restore into the `dev` branch is tested once and documented. Each availability check wakes production's Neon compute, which stays up about five minutes: up to about 30 of the 100 compute-unit hours a month of Neon's free plan until visits keep it awake anyway.
