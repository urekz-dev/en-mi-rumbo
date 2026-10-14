# ADR 0021: Panel users, roles and permissions in the database

- Status: accepted
- Date: 2026-10-14
- Owner: Alexis Zazueta

## Context

ADR 0010 protects `/admin` with Cloudflare Access: whoever is on the policy and receives the code is an admin, with no difference between people or localities. ADR 0006 stored an admin WhatsApp per locality, and ADR 0018 sends the daily email to "the admin mailboxes configured per locality". With several localities, each needs its own admins, who should see and change only the cards of their localities, while the founders keep access to everything. The team did not want those emails and numbers kept as GitHub Environment variables, and wants roles defined as data, not in code. A shared login for Urekz products (Condominia, and accounts for business owners) is decided after the launch.

## Decision

Cloudflare Access keeps authenticating: only the emails on its policy receive a code (ADR 0010). Authorization lives in PostgreSQL:

- `users`: the people who use the panel, identified by the email Access verifies (stored lowercase), with a name and an active flag.
- `permissions`: the catalogue of actions the panel checks, such as `businesses.review` or `users.manage`. The code checks these keys and holds the same catalogue (`src/core/access/permissions.ts`); a test fails when the two differ. A new permission comes with the screen or action that checks it.
- `roles`: bundles of permissions with a scope, `global` or `locality`. Super admins create and edit roles from the panel. A `system` role cannot be changed or deleted (a trigger enforces it), and `all_permissions` gives a role every permission, including later ones.
- `role_assignments`: a role given to a user, everywhere for a global role, in one locality for a locality role. The database keeps the locality consistent with the role's scope, and a role in use cannot be deleted.

The migrations create the catalogue and two base roles: `super_admin` (global, system, every permission) and `locality_admin` (per locality: review, edit, unpublish, delete, pending edits, reports, links, zones and the audit log). The first super admin is inserted by hand in the database of each environment; from then on, super admins create users, roles and assignments from the panel. Nothing about people lives in the repository or in GitHub.

A user may act in a locality when an active assignment that applies there grants the permission; actions that are not about one locality (users, roles, localities) need a global assignment. A user on the Access policy without an active assignment opens nothing. The locality keeps a public contact WhatsApp, the number "Perdí mi enlace" opens, instead of an admin's number, and the daily email of a locality goes to every active user who may review registrations there. This amends ADR 0006 (admin WhatsApp) and ADR 0018 (configured mailboxes).

## Consequences

Admins and their localities change without a deploy. Removing a person means deactivating the user and taking the email off the Access policy; the email lives in both places until the shared login replaces Access. Roles are data, so a badly built role can grant too much: only `users.manage` and `roles.manage`, which only super admins hold, change roles and assignments, and the system role cannot be weakened. Each panel request resolves the user's permissions with one query. When the shared login arrives, `users` becomes its user table and these roles carry over.
