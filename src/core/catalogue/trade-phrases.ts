// The curated phrases of the trades (docs/specs/public-directory.md,
// "Indexable trade page at the root, generated from the closed catalogue" and
// "From the card the pages of its trades are reached"): the catalogue name is
// not always what people search for, nor what reads well in a heading. People
// search for the classes, not the sport ("clases de futbol"), and a name with
// a slash reads badly in a heading. The table is editorial content, so it
// lives in the code and not in a migration; a trade without an entry uses its
// catalogue name, so a new trade never breaks a page.

/** Trade slug → the phrase that heads and titles its page and names it on a card. */
export const TRADE_PHRASES: Readonly<Record<string, string>> = {
  // Sports: what is searched for is the classes, not the sport.
  futbol: "Clases de futbol",
  box: "Clases de box",
  natacion: "Clases de natación",
  basquetbol: "Clases de basquetbol",
  "taekwondo-artes-marciales": "Clases de taekwondo y artes marciales",
  "danza-zumba": "Clases de danza y zumba",
  "atletismo-corredores": "Atletismo y clubes de corredores",
  gimnasio: "Gimnasios",
  ciclismo: "Ciclismo",
  // Catalogue names with a slash, which read badly in a heading.
  "fonda-comida-corrida": "Fondas y comida corrida",
};

/** The phrase of a trade; never empty: a blank catalogue name falls back to the slug. */
export function tradePhrase(trade: { name: string; slug: string }): string {
  const curated = TRADE_PHRASES[trade.slug];
  if (curated !== undefined) return curated;
  const name = trade.name.trim();
  return name === "" ? trade.slug : name;
}
