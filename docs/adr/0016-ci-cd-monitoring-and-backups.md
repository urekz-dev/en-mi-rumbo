# ADR 0016: CI/CD, monitoring and backups with GitHub Actions

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context
Workers Builds cannot run PostgreSQL or Playwright and has few concurrent builds on the free plan. The public repository has unlimited Actions minutes. The team's other repositories already use hardened workflows: read-only permissions by default, actions pinned by commit SHA, no untrusted input inline, actionlint and zizmor checks, Dependabot grouped weekly with a cooldown. Neon's free plan has a short restore window, Workers cannot run `pg_dump`, and `pg_dump` must be at least the server's major version.

## Decision
GitHub Actions for everything. One pull request pipeline: `vp run check:all`, unit and integration tests with a PostgreSQL service, the build, and Playwright. Three deploy workflows: manual to `dev` by branch (ADR 0008), automatic to `stage` on `main`, and tag to production with a GitHub Release and a smoke test. Each builds for its environment and deploys with the project's Wrangler, using an account API token that can create Workers and write Workers Routes on the enmirumbo.com zone; R2 buckets and Hyperdrive configurations are created once outside CI. A scheduled workflow every 30 minutes requests the home page and a health route of production and fails if either does not answer, which emails the team. A nightly workflow installs the PostgreSQL 18 client from the PGDG repository, runs `pg_dump -Fc` against production's direct connection string, and uploads the dump through R2's S3 API to a private bucket whose lifecycle rule deletes objects after 30 days; the R2 token is scoped to that bucket. All workflows follow the hardening above; Infisical supplies credentials through OIDC.

## Consequences
No external monitoring or backup vendor. Backups contain personal data and the bucket is private with no public hostname; access is through the Cloudflare account only. A restore into the `dev` branch is tested once and documented.
