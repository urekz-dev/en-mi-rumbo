// Scenarios of docs/specs/base-layout.md, requirements "Server Component with
// a document in es-MX and base metadata" (the title and the description) and
// "Every text that names the locality reads it from the locality record (v2)",
// for the helpers of src/lib/site.ts. The rendered layout is tested in
// test/astro/layout.test.ts.
import { describe, expect, it } from "vite-plus/test";
import { documentTitle, homePath, ROOT_DESCRIPTION, siteDescription } from "../../src/lib/site.ts";

const TIZAYUCA = {
  name: "Tizayuca",
  slug: "tizayuca",
  state: { code: "13", name: "Hidalgo", slug: "hidalgo" },
};
const OTHER = {
  name: "Pueblo Uno",
  slug: "pueblo-uno",
  state: { code: "98", name: "Estado de prueba 98", slug: "estado-de-prueba-98" },
};

describe("Server Component with a document in es-MX and base metadata", () => {
  // Scenario: the home keeps the site title
  it("a page without a title of its own takes the site title, with the geography in the descriptor", () => {
    expect(documentTitle(undefined, TIZAYUCA)).toBe(
      "enmirumbo — Encuentra negocios y servicios en Tizayuca",
    );
  });

  // Scenario: a page with its own title carries the brand at the end
  it("a page with its own title carries the brand at the end", () => {
    expect(documentTitle("Servicios del hogar en Tizayuca", TIZAYUCA)).toBe(
      "Servicios del hogar en Tizayuca — enmirumbo",
    );
    expect(documentTitle("Panel de revisión", undefined)).toBe("Panel de revisión — enmirumbo");
  });

  it("a blank title counts as none", () => {
    expect(documentTitle("  ", TIZAYUCA)).toBe(documentTitle(undefined, TIZAYUCA));
  });

  // Scenario: document in Mexican Spanish with metadata
  it("the description names the locality", () => {
    expect(siteDescription(TIZAYUCA)).toBe(
      "Encuentra negocios, servicios y deporte en Tizayuca y contáctalos directo por WhatsApp. Registro gratis para negocios locales.",
    );
  });

  it("outside a locality the title is the brand alone and there is no site description", () => {
    expect(documentTitle(undefined, undefined)).toBe("enmirumbo");
    expect(siteDescription(undefined)).toBeUndefined();
  });

  // Scenario: the root's description (Pages outside a locality name no locality (v2))
  it("the root's own description names no locality", () => {
    expect(ROOT_DESCRIPTION).toBe(
      "Encuentra negocios, servicios y deporte de tu municipio y contáctalos directo por WhatsApp. Registro gratis para negocios locales.",
    );
    expect(ROOT_DESCRIPTION).not.toMatch(/tizayuca|hidalgo/i);
  });

  it("the home is the locality's home on its routes, and the root elsewhere", () => {
    expect(homePath(TIZAYUCA)).toBe("/hidalgo/tizayuca");
    expect(homePath(undefined)).toBe("/");
  });
});

describe("Every text that names the locality reads it from the locality record (v2)", () => {
  // Scenario: a second locality
  it("another locality gets its own names, and Tizayuca appears nowhere", () => {
    const texts = [documentTitle(undefined, OTHER), siteDescription(OTHER), homePath(OTHER)];
    expect(texts).toEqual([
      "enmirumbo — Encuentra negocios y servicios en Pueblo Uno",
      "Encuentra negocios, servicios y deporte en Pueblo Uno y contáctalos directo por WhatsApp. Registro gratis para negocios locales.",
      "/estado-de-prueba-98/pueblo-uno",
    ]);
    expect(texts.join(" ")).not.toMatch(/tizayuca|hidalgo/i);
  });
});
