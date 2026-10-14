// The pure half of the search (src/core/search/normalize.ts): what is stored
// and what is searched, decided before anything touches the database. The
// matching against the database is in search.test.ts.
import { describe, expect, it } from "vite-plus/test";
import {
  MAX_QUERY_LENGTH,
  MAX_TERMS,
  normalizeText,
  searchColumns,
  searchTerms,
} from "../../src/core/search/normalize.ts";
import { escapeLike } from "../../src/core/search/query.ts";

// The fixture locality of search.test.ts; any name works for the pure tests.
const LOCALITY = "Pueblo Uno";
const terms = (query: string) => searchTerms(query, LOCALITY);

describe('The business stores a normalized version of its name and of "¿Qué ofreces?" for the search', () => {
  it("creation with accents and capitals", () => {
    expect(searchColumns("Plomería Güicho", "Destape de drenajes y BOMBAS de agua")).toEqual({
      nameNormalized: "plomeria guicho",
      whatYouOfferNormalized: "destape de drenajes y bombas de agua",
    });
  });

  it('business without "¿Qué ofreces?"', () => {
    for (const whatYouOffer of [null, undefined, "", "   ", "¡¿?!"]) {
      expect(searchColumns("Fonda Doña Cuquita", whatYouOffer)).toEqual({
        nameNormalized: "fonda dona cuquita",
        whatYouOfferNormalized: "",
      });
    }
  });

  it("the same text always gives the same value, composed or decomposed", () => {
    expect(normalizeText("Plomería".normalize("NFC"))).toBe(
      normalizeText("Plomería".normalize("NFD")),
    );
    expect(searchColumns("Piñatería Fiesta", "Piñatas")).toEqual(
      searchColumns("Piñatería Fiesta", "Piñatas"),
    );
  });
});

describe("Case- and accent-insensitive matching, and partial by word stem", () => {
  it("case and accents do not matter", () => {
    expect(normalizeText("PLOMERÍA")).toBe("plomeria");
    expect(normalizeText("Plomería")).toBe("plomeria");
    expect(terms("PLOMERÍA")).toEqual(terms("plomeria"));
    expect(terms("Plomería")).toEqual(terms("plomeria"));
  });

  it("punctuation becomes a space and spaces collapse", () => {
    expect(normalizeText("Fonda / comida corrida")).toBe("fonda comida corrida");
    expect(normalizeText("  tacos,   tortas y ¡quesadillas!  ")).toBe("tacos tortas y quesadillas");
    expect(normalizeText("Futbol de 6 a 12 años")).toBe("futbol de 6 a 12 anos");
  });

  it('"plomero" finds "plomería": both share the five-letter stem', () => {
    expect(terms("plomero")).toEqual(["plome"]);
    expect(terms("plomería")).toEqual(["plome"]);
    expect(terms("futbol")).toEqual(["futbo"]);
    expect(terms("fútbol")).toEqual(["futbo"]);
    expect(terms("taco")).toEqual(["taco"]);
  });

  it('the "ñ" does not break the search', () => {
    expect(normalizeText("Piñatas")).toBe("pinatas");
    expect(terms("piñatas")).toEqual(terms("pinatas"));
  });

  it("several words are all required, each by its stem", () => {
    expect(terms("futbol infantil")).toEqual(["futbo", "infan"]);
    expect(terms("veterinario espacial")).toEqual(["veter", "espac"]);
  });

  it("filler words do not reduce the results", () => {
    expect(terms("quien me arregla la cerrajeria")).toEqual(["cerra"]);
    expect(terms("necesito un plomero cerca")).toEqual(["plome"]);
    expect(terms("donde venden pinatas")).toEqual(["pinat"]);
    expect(terms("quien repara lavadoras y refrigeradores")).toEqual(["lavad", "refri"]);
  });

  it("filler words are discarded before the term cap", () => {
    expect(terms("de la el en con que plomero")).toEqual(["plome"]);
  });

  it("query of only filler words", () => {
    expect(terms("quien me")).toEqual(["quien", "me"]);
    expect(terms("necesito uno")).toEqual(["neces", "uno"]);
  });

  it("each stem is required once", () => {
    expect(terms("plomero plomería plomeros")).toEqual(["plome"]);
  });
});

// Fictitious locality names: no real one is written outside the locality data.
describe("The name of the locality is a filler word of its own search (v2)", () => {
  it("the name of the locality being searched", () => {
    expect(terms("cerrajeria en Pueblo Uno")).toEqual(["cerra"]);
    const name = "Villa de San Serafín";
    expect(searchTerms("cerrajería en Villa de San Serafín", name)).toEqual(["cerra"]);
    expect(searchTerms("cerrajeria serafin", name)).toEqual(["cerra"]);
    // Only the name: searched as is, like any query of only filler words.
    expect(searchTerms("Villa de San Serafín", name)).toEqual(["villa", "de", "san", "seraf"]);
  });

  it("the name of another locality", () => {
    expect(searchTerms("cerrajeria serafin", LOCALITY)).toEqual(["cerra", "seraf"]);
  });
});

describe("Empty query and hostile terms bounded, without error", () => {
  it("empty or only-spaces query", () => {
    for (const query of ["", " ", "     ", "\t\n"]) expect(terms(query)).toEqual([]);
  });

  it("extremely long query", () => {
    expect(terms("plomero ".repeat(5_000))).toEqual(["plome"]);
    expect(terms("x".repeat(100_000))).toEqual(["xxxxx"]);
    expect(terms("🌮".repeat(50_000))).toEqual([]);
    expect(terms("uno dos tres cuatro cinco seis")).toEqual(["dos", "tres", "cuatr", "cinco"]);
    expect(terms("aa bb cc dd ee ff")).toHaveLength(MAX_TERMS);
  });

  it(`only the first ${MAX_QUERY_LENGTH} normalized characters count`, () => {
    expect(terms(`${"ab ".repeat(30)}plomero`)).toEqual(["ab"]);
    // The cut never leaves half a word: "electricista" does not become "elec".
    expect(terms(`${"cd ".repeat(18)}gas electricista`)).toEqual(["cd", "gas"]);
  });

  it("leading junk that the normalization removes does not use up the length", () => {
    for (const junk of [
      " ".repeat(80),
      ".".repeat(80),
      "🎉".repeat(40),
      "Привет ".repeat(20),
      "%_".repeat(60),
    ]) {
      expect(terms(`${junk}plomero`)).toEqual(["plome"]);
    }
  });

  it("characters that would be wildcards in a search", () => {
    for (const query of ["%", "_", "%_%", "\\", "%%%%"]) expect(terms(query)).toEqual([]);
    expect(normalizeText("100%_seguro")).toBe("100 seguro");
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("odd alphabets and symbols", () => {
    for (const query of ["🎉🎈", "Привет", "日本語", "!!!???", "\u0000\u001B"]) {
      expect(terms(query)).toEqual([]);
    }
    expect(normalizeText("tacos 🌮 al pastor")).toBe("tacos al pastor");
  });

  it("no term ever carries a wildcard, a quote or markup", () => {
    for (const query of [
      "%plom%",
      "_taco_",
      "ta%co",
      "a'b\"c",
      "<b>plomero</b>",
      "'; DROP TABLE businesses; --",
    ]) {
      for (const term of terms(query)) expect(term, query).toMatch(/^[a-z0-9]{2,5}$/);
    }
  });
});
