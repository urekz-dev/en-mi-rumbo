# ADR 0014: Analytics with Umami Cloud

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

Cloudflare Web Analytics cannot record custom events, and the product's core metric is the WhatsApp click. Workers Analytics Engine records events but has no dashboard, and a metrics view of our own is out of scope. Umami is cookieless, records events from `data-umami-event` attributes without custom JavaScript, and its cloud Hobby plan is free for one website, 100,000 events per month and six months of data.

## Decision

Umami Cloud on the Hobby plan for production only; `stage` and `dev` load no analytics. Three events, each with locality and category: WhatsApp click from a card, search with no results, and registration submitted. The admin panel and the management-link screens are outside measurement. Umami is named as a processor in the privacy notice.

Amended on 2026-10-15 (EMR-34), by decision of the product owner:

- There are four events: a WhatsApp click from a listing card (`whatsapp-listing`) joins the WhatsApp click from a card (`whatsapp-card`), the search with no results and the registration submitted, with the same two properties, locality and category. Most contacts may start from a listing, where the WhatsApp button opens the conversation without going through the card, and without the event they would not be counted at all. Keeping it apart from the card's event preserves the card's clicks over its views as a metric of its own (PRD §10).

Amended again on 2026-10-15 (EMR-36), by decision of the product owner:

- The search with no results is not an event. The results page knows it found nothing when the server renders it, so it tags its page view instead: the Umami script of that page carries `data-tag="search-no-results"`, and the tagged views are filtered in Umami and compared with all the views of the results page. It needs no JavaScript of the site and no count on the server, and the text searched never reaches Umami: the tag is a fixed word and the script already leaves the query out of the address (`data-exclude-search`). Three events remain: `whatsapp-listing`, `whatsapp-card` and `registration-submitted`.

## Consequences

Ad blockers undercount; if an exact contact count is ever needed, a redirect route in the Worker can count it server-side. Moving to the Pro plan (20 USD per month) adds websites for `stage` and longer retention.
