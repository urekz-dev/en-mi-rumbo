# ADR 0019: Backend structure and local development

- Status: accepted
- Date: 2026-10-12
- Owner: Alexis Zazueta

## Context

enmirumbo launches as a directory, but the team plans transactional features later: ratings and reviews, paid priority for businesses, menus, reservations and delivery. A second Urekz product, Condominia (a mobile app first, with a web version, whose users always have an account), will show enmirumbo as one of its sections and talk to it. People who only search and contact businesses on enmirumbo do not need an account. The launch has to be fast.

In this stack the backend is the Worker that serves the site: server-rendered pages read, Astro Actions write, middleware protects the panel, the scheduled handler runs the jobs, and bindings reach PostgreSQL, R2 and Images. In local development workerd simulates every Cloudflare binding except PostgreSQL, which needs a real server. Running the database natively lets each machine drift to a different version; a shared cloud database lets people overwrite each other's data and, with a branch per person, spends Neon compute hours beyond the free plan.

## Decision

Until launch, one package and one Worker. Business rules and data access live in `src/core/`, which never imports Astro (`astro` or `astro:*`); an Oxlint rule enforces the boundary. Pages and Actions validate input, authorize the request and call the core.

Right after launch, the repository becomes a monorepo: `apps/web` (the Astro site), `packages/core` (moved from `src/core/`) and `apps/api`, a Worker with Hono that serves a versioned REST API (`/v1`, described with OpenAPI) for Condominia, plus webhooks or events for changes. Workers in the same Cloudflare account talk through service bindings. A shared Urekz login for end users is decided at that point. Each product keeps its own database, and products only talk through their APIs. Everything stays on Cloudflare and Neon.

Local development runs the application natively with `vp run dev`, inside workerd. Only supporting services run in containers, through Docker Compose: PostgreSQL 18 (`postgres:18`) now, a mail catcher (Mailpit) when email arrives, and PostGIS when distances are needed. Tests use their own database in the same container and never touch development data. CI runs the same image as a GitHub Actions service container. Docker Desktop and Colima both work.

## Consequences

Launching takes no extra time beyond keeping the core boundary, and the later API moves files instead of rewriting rules. Every contributor needs Docker or Colima for the database, and gets the same PostgreSQL version as CI and Neon. The application itself is never containerized: production runs on Workers, and workerd already gives runtime parity. Costs grow with features (payment fees, maps, messaging and, if chosen, a managed login priced per active user), not with the infrastructure. Accounts, reviews, payments, delivery and the partner API stay out of scope for version 1.
