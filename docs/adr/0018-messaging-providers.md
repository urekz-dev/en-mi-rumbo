# ADR 0018: Messaging providers: Resend for email, Twilio Verify behind a flag

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

The admin needs a daily email with pending items and retention warnings. SMS verification of the WhatsApp number exists in the prototype behind a flag that is off, and must stay available without becoming a launch dependency. Cloudflare's own email sending service exists but the team already standardised on Resend.

## Decision

Resend sends the daily email from the `enmirumbo.com` domain (SPF and DKIM records in Cloudflare DNS) to the admin mailboxes configured per locality (amended by ADR 0021: the panel users who may review registrations in that locality); non-production environments send only to team mailboxes. Twilio Verify handles the SMS code when the flag is on, with per-IP and per-number quotas because each SMS costs money; with the flag off no Twilio credential is required and the registration flow is identical to the prototype's.

## Consequences

Two more processors named in the privacy notice. The Twilio account can be created when the flag is first needed.
