# Changelog

All notable changes to this product are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/spec/v2.0.0.html). Versions stay at 0.x until the cut-over, which is 1.0.0.

## [Unreleased]

### Added

- Architecture decision records 0001–0018 and the product requirements document.
- Devlog template.
- ADR 0019: backend structure and local development.
- ADR 0020: secrets in GitHub Environments, replacing ADR 0009.
- ADR 0021: panel users, roles and permissions in the database.
- The admin panel at `/admin`, protected by Cloudflare Access: the Worker verifies the Access token of every admin request and answers 403 without one. Locally it opens with a fixed identity.
- Three deployed environments, `dev`, `stage` and `prod`, on `workers.dev`, with their deploy workflows: `dev` by hand from any branch (its database is reset from `stage`, and the page footer names the branch and commit), `stage` on every push to `main`, and `prod` from a tag `vX.Y.Z`, which also creates the GitHub Release. Each deploy checks its build first and runs a smoke test after.
- Every deployed environment, production included, asks search engines not to index it (`X-Robots-Tag: noindex` and a closed `robots.txt`) until the cut-over.
- `/health` answers `ok` when the site reaches its database.
- Production is checked every 30 minutes, and backed up every night to a private bucket that keeps each backup for 30 days. The README describes how to restore one.
- Public pages may show a change made in the panel up to a minute late, and the panel says so.
- The data model: states and municipalities from INEGI, localities, zones, categories, trades, businesses, pending edits, reports and the admin audit log. A WhatsApp number has one card per locality, and each card has a short random identifier.
- Panel users, roles and permissions in the database: super admins manage everything, locality admins only their localities, and new roles are created as data. ADR 0021.
- The INEGI catalogue of the 32 states and 2,478 municipalities, with the slugs of the public URLs, in every environment, and the locality of Tizayuca, inactive until a super admin sets its contact WhatsApp and activates it.
- The zones of Tizayuca, in every environment: its 105 colonias, fraccionamientos, barrios, pueblos and other settlements from SEPOMEX's postal catalogue, each with its type and the slug of its public URLs.
- The search, without its page yet: the published cards of a locality are found by their name, by what they offer and by the trades the admin assigned, ignoring capitals, accents and punctuation and matching the stem of each word ("plomero" finds "plomería"). Filler words and the name of the locality do not narrow the results, and an empty or hostile query searches nothing. The database keeps the normalized search text of every business itself.
- The 8 categories and the 49 trades of the directory, in every environment, each with the slug of its public URLs.
- No URL of a locality can be read in two ways: the tests fail when a category, a trade, a zone or a trade and zone pair would take the URL of another, or of one of the site's own pages.
- Fictitious businesses for development, `dev` and `stage`: twelve made-up cards in Tizayuca, published in several categories and zones, one in review and one rejected, which also turn Tizayuca on there with a made-up contact WhatsApp while it has none. They never reach production.
- The pages of a locality live under its state and municipality, such as `/hidalgo/tizayuca`. An unknown state or municipality, one under another state, or a locality that is not active answers 404. While one locality is active, `/` redirects to it; with none, `/` keeps the placeholder.
- Canonical and share-preview URLs are absolute and carry the full path of the locality, from the public URL of each environment.
- The tests fail when a link or a form of the site leads to a page that does not exist, when a link of a locality's page leaves out its state and municipality, or when a link that opens a new tab lacks `rel="noopener noreferrer"`.
- The privacy notice at `/aviso-de-privacidad` and the terms at `/terminos`, linked from the footer of every page. They belong to no locality and name none, and are prerendered and served as static files. The notice is at version 2: it names the processors (Cloudflare, Neon, Twilio, Resend and Umami) and links to Cloudflare's Turnstile privacy addendum, says how the IP address is used, lists the two cookies, gives the retention periods and says that the rights are served from the panel. Until the legal review, both pages show their missing data in square brackets and a draft mark. Changing the text of the notice without raising its version makes the tests fail.
- With two or more active localities, `/` lists them, each with its municipality and state. Choosing one remembers it in a cookie that holds only its slug, for a year, and later visits to `/` go straight to it; the pages of a locality offer "Cambiar de municipio" to choose again. The list highlights the locality nearest to the visitor's approximate location, measured to its municipal seat, and never redirects by it. Activating a second locality is a data change only.
- The coordinates of Tizayuca's municipal seat, from INEGI, in every environment.
- The global layout of every page: a header with the enmirumbo wordmark, a footer with the line "Hecho para los vecinos de {municipio}, {estado}." read from the locality, the prototype's palette and typography as design tokens with WhatsApp green kept for the main action, and a 404 page in Spanish. Phones no longer turn numbers in the text into call links. On `dev`, the branch and commit deployed now show in the footer of every page.

- `/sitemap.xml`, generated from the database on every request: the home of every active locality and the two legal pages, with absolute URLs from the public URL of each environment. The pages of the directory add themselves to it as they arrive.
- Where search engines are allowed (locally now, production after the cut-over), `/robots.txt` lets them crawl the public site, keeps them out of the panel, the search results, the report forms and the thank-you pages of every active locality, and points to the sitemap. The deployed environments keep the closed one until the cut-over.
- Every indexable page declares its canonical address and its share preview: title, description, address and a 1200×630 image. Each locality has its own image with the wordmark and its municipality and state, Tizayuca's first; a page outside a locality, or a locality without its image, shares the wordmark alone.
- Measurement with Umami Cloud, ready and off: it loads only in production, only with the site's Website ID, deferred, never in the panel or the edit mode, and never sends the query of an address. The four events have their names: the WhatsApp clicks from a listing card and from a card, apart, the search with no results and the registration submitted (ADR 0014, amended). Until the launch sets the Website ID, no page loads it and no request leaves the site.
- Every response, static files included, carries a content security policy that only lets scripts come from the site, Turnstile and, where it measures, Umami; forbids inline scripts and styles, plugins, framing by another site and forms posting to another site; and comes with `nosniff`, `X-Frame-Options: DENY` and a referrer policy that never sends a path to another site. The panel keeps its stricter referrer policy. The deploy refuses a build whose static files lack them, and the smoke test checks them.
- The card of every published business at `/{estado}/{municipio}/negocio/<nombre>-<id>`: its name, the "Negocio verificado" seal, what it registered and nothing it left blank, its trades, and "Enviar WhatsApp" with the message "Hola, te vi en enmirumbo. ¿Me das informes?", plus "Llamar", "Cómo llegar" and the page it registered, showing its real domain, when it gave them. A card in review, rejected, deleted or of another locality answers the same 404 as one that never existed, a pending edit never shows, and a link with an earlier name redirects to the current one. Each card has its own title, description and share preview, declares itself to search engines as a local business with its zone but never its address or numbers, and is listed in the sitemap with its publication date. Only its WhatsApp button is measured.
- The listing card that the listings and the search will show: the emoji of its category in place of a photo, the name, the zone, "A domicilio" and WhatsApp in one tap, measured apart from the card's.

### Changed

- The brand is written enmirumbo, lowercase and in one word.
- The smoke test after each deploy follows the redirect of the home page, which leads to the locality while only one is active.
- The database keeps only the reference data of Tizayuca, the one city the directory serves: the state of Hidalgo, the municipality of Tizayuca, its locality and its 105 zones. The other 31 states and 2,477 municipalities of INEGI's catalogue are removed from every environment; their addresses answer 404, as before. Cities are added one at a time, each in its own data migration. ADR 0006 is amended.
- Locally, `/robots.txt` is the open one that production will serve after the cut-over.

### Removed

- The short address of a locality, such as `/tizayuca`, which only `dev` and `stage` served: public addresses always carry the state and the municipality, and `/tizayuca` answers 404. ADR 0007 is amended.
- The scripts that wrote the migrations of INEGI's catalogue and of SEPOMEX's zones (`vp run db:inegi` and `vp run db:zones`). How the data of a new city is prepared is decided when one is needed.
