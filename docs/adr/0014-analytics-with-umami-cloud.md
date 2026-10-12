# ADR 0014: Analytics with Umami Cloud

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

Cloudflare Web Analytics cannot record custom events, and the product's core metric is the WhatsApp click. Workers Analytics Engine records events but has no dashboard, and a metrics view of our own is out of scope. Umami is cookieless, records events from `data-umami-event` attributes without custom JavaScript, and its cloud Hobby plan is free for one website, 100,000 events per month and six months of data.

## Decision

Umami Cloud on the Hobby plan for production only; `stage` and `dev` load no analytics. Three events, each with locality and category: WhatsApp click from a card, search with no results, and registration submitted. The admin panel and the management-link screens are outside measurement. Umami is named as a processor in the privacy notice.

## Consequences

Ad blockers undercount; if an exact contact count is ever needed, a redirect route in the Worker can count it server-side. Moving to the Pro plan (20 USD per month) adds websites for `stage` and longer retention.
