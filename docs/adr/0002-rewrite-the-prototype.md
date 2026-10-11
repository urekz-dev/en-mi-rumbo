# ADR 0002: Rewrite the prototype from scratch

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context
The prototype at `SoyJorgePilo/enmirumbo` was built before the team fixed its tools and way of working: Next.js App Router, Prisma, Supabase, Vercel, an agent pipeline of its own, and a migration to Astro left halfway. Production holds no real data. The prototype's lasting value is its functional contract: seven consolidated specifications with 168 requirements and 751 scenarios, plus a user interface already validated with the founder.

## Decision
We rebuild EnMiRumbo from scratch in a new repository, keeping functionality and user interface one to one and reusing no code. The specifications are the contract: parity is validated against them, not against the old code. The stack, hosting, process and tooling change entirely (ADR 0003 to 0018).

## Consequences
We pay the full cost of reimplementation but inherit none of the prototype's debt (vulnerable image library, half-migrated framework, hosting outside the team's platform). The user interface is compared screen by screen against the prototype before each epic closes. The prototype keeps running on Vercel until the cut-over and is archived afterwards.
