// What the results page shows of what a resident typed (docs/specs/
// public-directory.md, "Results page with the same cards as the listing" and
// "Empty query and hostile terms bounded, without error"): in its heading,
// `Resultados para "…"`, and back in the search box, so it can be corrected
// without going back. Astro escapes it, so markup is only text; this bounds
// what escaping does not: a string of thousands of characters, and the
// invisible characters a link shared on WhatsApp could carry. Everything here
// is pure.

/** Characters of the query shown at most; the search itself looks at fewer. */
export const MAX_DISPLAYED_LENGTH = 80;

/**
 * Control (`Cc`, NUL and line breaks included) and format (`Cf`, the bidi
 * overrides that make a heading read backwards) characters. They become a
 * space, so words typed apart stay apart.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;

export interface DisplayedQuery {
  /** What the search box is filled with: never a trailing "…" to resubmit. */
  field: string;
  /** What the heading and the no-results notice quote: "…" when it was cut. */
  quoted: string;
}

/** Splits text into what a person sees as characters: an emoji is one, accents included. */
const GRAPHEMES = new Intl.Segmenter("es-MX", { granularity: "grapheme" });

/**
 * The longest character kept whole, in UTF-16 units: an emoji with its skin
 * tone or a flag fits. A longer one is a letter buried under stacked accents
 * ("Zalgo" text), and only its first code point is kept.
 */
const MAX_CHARACTER_UNITS = 8;

/**
 * The query as the page shows it: without invisible characters, with its
 * spaces collapsed, and cut to `MAX_DISPLAYED_LENGTH` characters as a person
 * sees them, so an emoji or an accented letter is never cut in half. Only
 * the characters shown are read, however long the query.
 */
export function displayedQuery(query: string): DisplayedQuery {
  const clean = query.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  const characters: string[] = [];
  for (const { segment } of GRAPHEMES.segment(clean)) {
    if (characters.length > MAX_DISPLAYED_LENGTH) break;
    const codePoint = segment.codePointAt(0) ?? 0;
    characters.push(
      segment.length > MAX_CHARACTER_UNITS ? String.fromCodePoint(codePoint) : segment,
    );
  }
  const whole = characters.length <= MAX_DISPLAYED_LENGTH;
  const shown = characters.slice(0, MAX_DISPLAYED_LENGTH).join("").trimEnd();
  return whole ? { field: shown, quoted: shown } : { field: shown, quoted: `${shown}…` };
}
