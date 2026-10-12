# ADR 0007: Single-host URLs with state and municipality segments

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

Public URLs must carry the locality. Two shapes were considered: a subdomain per state (`hidalgo.enmirumbo.com/tizayuca/...`) and path segments on one host (`enmirumbo.com/hidalgo/tizayuca/...`). Subdomains dilute search authority across hosts, put branch previews at a third level outside Universal SSL, and need a middleware rewrite that breaks Astro Actions forms. Google advises against adapting content automatically from the visitor's IP, and Googlebot crawls from the United States.

## Decision

One host with two positional segments: `/{estado}/{municipio}/...`, for example `/hidalgo/tizayuca/plomeria-haciendas-de-tizayuca`. While there is a single active locality the root responds with a 301 to it, and the short alias `/tizayuca` does the same for printed material. When there are two or more localities the root shows the list with the nearest one highlighted using the approximate location Cloudflare attaches to each request; the visitor's choice is stored in a cookie holding only the locality slug, and later visits to the root redirect to it. No automatic redirect based on location.

## Consequences

One domain, one sitemap, one certificate. Every public route handler resolves the locality from the path before anything else. The privacy notice lists the locality cookie.
