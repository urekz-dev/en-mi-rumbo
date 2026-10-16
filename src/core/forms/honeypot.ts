// The trap field of the public forms (docs/specs/public-directory.md, "Report
// anti-abuse without captcha: honeypot, per-IP quota and pending cap per
// business" and "The honeypot of the report form is trimmed before it is
// checked (v2)"; docs/specs/business-registration.md, "The registration and
// edit forms are protected by quotas, honeypot and Turnstile (v2)"). People
// never see it (src/components/HoneypotField.astro): a bot that fills every
// field fills it too. Its value is trimmed before it is checked, so a stray
// space from a keyboard or an autofill never turns a person into a bot.
// Everything here is pure.

/** The name of the trap field. Neutral, so no browser autofill targets it. */
export const HONEYPOT_FIELD = "website";

/**
 * Whether a submission filled the trap field: any value that is not empty or
 * whitespace once trimmed, in any of the field's values. A file where text was
 * expected never comes from the form, so it counts as filled.
 */
export function isHoneypotFilled(form: FormData): boolean {
  return form
    .getAll(HONEYPOT_FIELD)
    .some((value) => typeof value !== "string" || value.trim() !== "");
}
