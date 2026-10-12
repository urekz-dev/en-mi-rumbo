# ADR 0015: Testing strategy

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

The specifications contain 751 scenarios and are the parity contract. The application runs inside workerd with bindings (Hyperdrive, R2, Images, Durable Objects) that plain Node tests cannot emulate faithfully. Cloudflare's test integration is now `@cloudflare/vitest-plugin`, which supports the Vitest major bundled with Vite+ since early October 2026; its predecessor `@cloudflare/vitest-pool-workers` does not. Code coverage in workerd works with Istanbul, not V8.

## Decision

Three layers. Unit tests with Vitest for pure functions (validation, normalisation, slugs, quota logic). Integration tests inside workerd with `@cloudflare/vitest-plugin` against a real PostgreSQL (Docker locally, a service container in CI), exercising actions, routes and the scheduled handler with real bindings. End-to-end tests with Playwright against the built application served by `astro preview`, which runs in workerd, covering the user flows screen by screen, with and without JavaScript where the contract allows. Every requirement's scenarios map to tests by name; a story is not done while a scenario of its requirements has no test. If the Cloudflare plugin fails on the Vitest bundled with Vite+, the workers test project runs on a pinned Vitest 4 outside the bundle until it is fixed.

## Consequences

CI runs PostgreSQL as a service and installs Playwright browsers; no matrix of Node versions is needed because the code runs in workerd. Coverage is collected with Istanbul.
