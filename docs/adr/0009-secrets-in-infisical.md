# ADR 0009: Secrets managed in Infisical

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context
The repository is public. Infisical is the team's secrets manager and already has a project "En Mi Rumbo" with environments. Workers read secrets from their own store; GitHub Actions needs credentials for Cloudflare, Neon and the backups. Infisical's Cloudflare Workers Secret Sync targets an existing Worker script. GitHub repositories created after 2026-07-15, like this one, present an immutable OIDC subject that includes owner and repository ids.

## Decision
Infisical is the source of truth, with environments `dev`, `stage` and `prod`. One Cloudflare Workers Secret Sync per Worker pushes that environment's secrets, created after the Worker's first deploy, with the overwrite initial behaviour. CI authenticates to Infisical with an OIDC machine identity bound to this repository's immutable subject (read it with `gh api repos/urekz-dev/en-mi-rumbo/actions/oidc/customization/sub`), so no long-lived token lives in GitHub, and pulls what each workflow needs. Locally, `infisical run --env=dev -- vp run dev`; the committed `.infisical.json` holds only the project id and default environment. Secret names are documented in the README; values never appear in the repository, in Plane or in Notion.

## Consequences
Rotating a secret is done once, in Infisical. The sync needs a Cloudflare API token with Workers Scripts edit and Account Settings read permissions, held as an Infisical app connection. Turnstile, Umami, Resend, Twilio and Neon keys all follow this path.
