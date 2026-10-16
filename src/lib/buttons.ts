// The two button styles of the site (docs/specs/base-layout.md, "Palette and
// typography as reusable tokens with WhatsApp green as the primary action";
// docs/specs/public-directory.md, "Contact buttons on the card with WhatsApp
// as the main action"), for links and buttons alike. Each sets no padding or
// text size, so a place adds its own without two utilities of the same
// property fighting over it.

/**
 * The main action: WhatsApp green with `ink` text (never green text on a
 * light background), at least 44px tall. Only the main action uses it, so
 * nothing competes with the WhatsApp button.
 */
export const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-action font-semibold text-ink transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-action-strong focus:ring-offset-2";

/**
 * A secondary action: the same size and touch area, neutral, with the
 * `control` outline (3:1 or more, WCAG 2.1 1.4.11). It never uses the action
 * green, in its background, its text or its border.
 */
export const SECONDARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-control bg-background font-semibold text-ink transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-action-strong focus:ring-offset-2";
