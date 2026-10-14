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
- The search, without its page yet: the published cards of a locality are found by their name, by what they offer and by the trades the admin assigned, ignoring capitals, accents and punctuation and matching the stem of each word ("plomero" finds "plomería"). Filler words and the name of the locality do not narrow the results, and an empty or hostile query searches nothing. The database keeps the normalized search text of every business itself.

### Changed

- The brand is written enmirumbo, lowercase and in one word.
