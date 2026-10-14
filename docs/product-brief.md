# enmirumbo: product brief

> This is a copy. The canonical version is the Plane page "Product Overview" of the EMR project.

> One-page format (Linear): why, what, how. Updated when a product decision changes, not every week. Technical matters live in `github.com/urekz-dev/enmirumbo/docs` (PRD and ADR).

**Product owner:** Alexis Zazueta (interim, until the roles meeting confirms it).

**Status:** prototype running at `enmirumbo.com` (Vercel, domain at Namecheap), built before Urekz. On 2026-10-11 the team decided to rewrite it from scratch (ADR 0002), keeping functionality and UI one to one; the rewrite is the epics "A · Foundations of v2" to "H · Launch" in this project.

**Last review:** 2026-10-11

## Problem

In a mid-sized city (Tizayuca, Hidalgo) people find local businesses and services by asking in WhatsApp groups or by word of mouth; there is no simple place, in Spanish and without friction, to search for "cerrajero cerca" and contact one directly. Small businesses have no website and do not want to run one.

## Who it is for

- **Residents** who look for a nearby service or business and want to contact it by WhatsApp without signing up.
- **Local business owners** who want to appear at no cost and without maintaining a website.

## Why now

The prototype exists and works, but its stack and its process are not the team's and its code carries debt. It is the product with the most history and the only one with a public domain. Rebuilding it on the team's platform, with the prototype's specifications as the contract, is the best way to learn to take a product from prototype to operation with the Urekz way of working.

## What it is

A local directory with search by text and by category (restaurants, home services, beauty, health, groceries, workshops, sports clubs, among others), business cards with direct WhatsApp contact, and free registration for owners, verified by a person before publishing. Tagline: _"Encuentra negocios y servicios de aquí cerquita y contáctalos directo por WhatsApp."_ Version 2 adds a locality-aware data model (one city at launch, ready for more), the admin panel behind Cloudflare Access with an audit log, and product events in Umami.

## What it is not (for now)

- Not a marketplace and does not process payments.
- Not a native mobile app.
- Not multi-city: one city until retention is validated, although the data model is ready.
- No advertising, no paid plans, no star ratings, no metrics view of its own.

## How we will know it works

Confirmed metric for v1: **at least 50 active registered businesses and at least 200 WhatsApp contacts per month for two consecutive months**. Source: the WhatsApp-click event in Umami and approved registrations in the admin panel. The prototype's 60-day thresholds (publication within 48 hours, more than 70 % of registrations completed without help, 15 organic registrations) remain as operating guidance.

## Active bet

Epic "EMR v1: del prototipo al primer usuario real" in cycle 1 (closes 2026-11-01): brief and decision (done), minimal infrastructure (public repository with LICENSE, GitHub Environments for secrets, accounts with custodians; the DNS move to Cloudflare waits for EMR-63). The rewrite follows as epics A to H, proposed over cycles 2 to 5; the betting table decides each cycle.

## Decisions and links

- PRD: `docs/PRD.md` in the repository. ADR: `docs/adr/`, 0002 (rewrite) to 0021.
- Accounts: Cloudflare (zone, Workers, R2, Access, Turnstile), Neon, Resend, Umami Cloud, Twilio when the SMS flag is needed. Custodians in Notion → Tools & Vendors. Vercel and Namecheap until the cut-over.
- Secrets: GitHub Environments `dev`, `stage`, `prod` and `backup` of the repository (ADR 0020).
- Files: Drive → `Products/enmirumbo`.
