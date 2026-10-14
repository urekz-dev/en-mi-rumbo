// Text normalization of the search (docs/specs/data-model.md, "The business
// stores a normalized version of its name and of "¿Qué ofreces?" for the
// search"; docs/specs/public-directory.md, "Case- and accent-insensitive
// matching, and partial by word stem" and "Empty query and hostile terms
// bounded, without error"). What a business stores and what a resident types
// go through the same `normalizeText`, which is what makes "Plomería" stored
// and "PLOMERIA" typed compare equal. Everything here is pure: no database.

/** Characters of the normalized query that are looked at; the rest is ignored. */
export const MAX_QUERY_LENGTH = 60;

/** Terms required at most in one search. */
export const MAX_TERMS = 4;

/**
 * Length of the stem each term is compared with. Five lets "plomero" find
 * "plomería" (both are "plome") without the noise of a shorter stem.
 */
export const STEM_LENGTH = 5;

/** A one-character term matches almost everything, so it is dropped. */
const MIN_TERM_LENGTH = 2;

/**
 * Filler words: the words a resident states the question with, not the ones
 * that describe the business ("quien me arregla la cerrajeria"). They are
 * discarded before the term cap, so they never use up the quota of the useful
 * word, and only while another word remains. Dropping one can only widen the
 * results. They are compared already normalized. The name of the locality is
 * a filler word too, but it comes from the locality record (`searchTerms`).
 */
// prettier-ignore
const FILLER_WORDS: ReadonlySet<string> = new Set([
  // Articles, prepositions and conjunctions.
  "el", "la", "los", "las", "un", "una", "uno", "unos", "unas", "lo",
  "de", "del", "al", "en", "con", "por", "para", "y", "o", "que",
  // Pronouns and adverbs a question is asked with.
  "me", "te", "se", "mi", "tu", "su", "quien", "quienes", "donde", "cual",
  "aqui", "cerca", "hay", "algun", "alguna", "alguien",
  // Verbs of "¿quién hace X?".
  "necesito", "busco", "quiero", "ocupo", "conoces", "sabes", "recomiendan",
  "arregla", "arreglan", "arreglo", "repara", "reparan", "reparen",
  "hace", "hacen", "haga", "vende", "venden", "venda", "da", "dan", "puede",
]);

/** Combining marks left by NFD: accents, the diaeresis and the tilde of "ñ". */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Lowercase, without accents, with everything that is not `a-z0-9` turned into
 * a space and the spaces collapsed:
 *
 * - "Plomería Güicho" → "plomeria guicho"
 * - "Piñatas" → "pinatas"
 * - "100%_seguro" → "100 seguro"
 * - "🎉 Привет" → ""
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The stems a search requires, or an empty list when nothing searchable
 * remains (the page then shows the empty-query notice and queries nothing).
 * The order matters:
 *
 * 1. normalize first, which removes punctuation, emoji, other alphabets and
 *    the LIKE wildcards `%` and `_`, so leading junk cannot use up the length;
 * 2. keep the first `MAX_QUERY_LENGTH` characters of what is left, without
 *    a word cut in half;
 * 3. drop one-character words;
 * 4. drop the filler words and the words of the locality's name, unless
 *    nothing else is left: a query of only filler words is searched as is;
 * 5. keep each distinct stem once, and at most `MAX_TERMS` of them.
 *
 * What reaches the database is at most four `[a-z0-9]` stems of five
 * characters at most.
 */
export function searchTerms(query: string, localityName: string): string[] {
  const words = capLength(normalizeText(query))
    .split(" ")
    .filter((word) => word.length >= MIN_TERM_LENGTH);
  const localityWords = new Set(normalizeText(localityName).split(" "));
  const content = words.filter((word) => !FILLER_WORDS.has(word) && !localityWords.has(word));
  const useful = content.length > 0 ? content : words;
  const stems = new Set(useful.map((word) => word.slice(0, STEM_LENGTH)));
  return [...stems].slice(0, MAX_TERMS);
}

/**
 * The first `MAX_QUERY_LENGTH` characters of a normalized query, without the
 * word the cut would leave half-written; a single longer word is cut as is.
 */
function capLength(normalized: string): string {
  if (normalized.length <= MAX_QUERY_LENGTH) return normalized;
  const head = normalized.slice(0, MAX_QUERY_LENGTH + 1);
  const lastSpace = head.lastIndexOf(" ");
  return lastSpace > 0 ? head.slice(0, lastSpace) : head.slice(0, MAX_QUERY_LENGTH);
}

/** The two search columns of a business, ready to write. */
export interface SearchColumns {
  nameNormalized: string;
  whatYouOfferNormalized: string;
}

/**
 * The search columns of a business with this name and "¿Qué ofreces?". This is
 * the single place that computes them: every write that sets a business's name
 * or "¿Qué ofreces?" (registration, edit, the admin's edit, the seeds, the
 * backfill) spreads this into the same insert or update, and never takes the
 * columns from what a client sent. Without "¿Qué ofreces?" the value is the
 * empty string, never null.
 */
export function searchColumns(
  name: string,
  whatYouOffer: string | null | undefined,
): SearchColumns {
  return {
    nameNormalized: normalizeText(name),
    whatYouOfferNormalized: normalizeText(whatYouOffer ?? ""),
  };
}
