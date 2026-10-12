# ADR 0012: Abuse controls with Durable Object quotas and Turnstile

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

The privacy notice promises that the visitor's IP address is used for less than an hour, only in memory, never in the database. The admin verifies ten to fifteen cards per week, so fake registrations consume the scarcest resource. Cloudflare's Rate Limiting binding only supports 10- and 60-second windows and counts per location. Turnstile is free (20 widgets, 10 hostnames each, subdomains included) and in managed mode shows a checkbox only when Cloudflare is unsure.

## Decision

Per-IP quotas for registration, edits, reports, search and SMS live in a Durable Object keyed by an HMAC of the IP and the purpose; counters are deleted when their window ends and are never persisted to PostgreSQL. The registration and edit forms include Turnstile in managed mode; the Worker validates the token server-side and rejects submissions without a valid one. Turnstile is on from day one behind a kill switch so it can be turned off without a deploy if Cloudflare's challenge service fails or rejects legitimate people. The honeypot field stays.

## Consequences

The forms require JavaScript; the page says so when it is missing. The privacy notice references Cloudflare's Turnstile privacy addendum. The test keys allow local and CI runs without network.
