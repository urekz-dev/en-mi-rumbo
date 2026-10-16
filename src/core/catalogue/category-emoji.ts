// The decorative emoji of each category (docs/specs/public-directory.md, "The
// listing card brings the essentials and WhatsApp without extra taps", amended
// in the visual review batch 2): the placeholder of a business without a photo
// shows the emoji of its category, the same one as the category buttons of
// the home page. An emoji costs no bytes and no dependency: it lives in the
// system font. Where it is drawn it is `aria-hidden`; the name of the business
// is what a screen reader announces. A category this map does not know falls
// back to the generic emoji.

const EMOJI_BY_SLUG: Readonly<Record<string, string>> = {
  "restaurantes-y-fondas": "🍽️",
  "servicios-del-hogar": "🔧",
  belleza: "💇",
  salud: "🩺",
  "abarrotes-y-comercio": "🛒",
  talleres: "🛠️",
  "clubes-y-escuelas-deportivas": "⚽",
  otro: "✨",
};

/** The emoji of a category without its own. */
export const GENERIC_CATEGORY_EMOJI = "✨";

/** The decorative emoji of a category, by its slug; never fails. */
export function categoryEmoji(slug: string): string {
  return EMOJI_BY_SLUG[slug] ?? GENERIC_CATEGORY_EMOJI;
}
