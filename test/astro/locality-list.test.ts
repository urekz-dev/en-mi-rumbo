// Scenarios of docs/specs/public-directory.md for the list of localities at
// the root, rendered with Astro's Container API: "With two or more active
// localities the root lists them and never redirects by location (v2)" and
// "Geolocation is only a suggestion of the nearest locality (v2)". Which
// localities the root lists and suggests, the choice and the cookie are
// tested in test/worker/locality-routes.test.ts, and the served page, with
// simulated locations, in test/e2e/two-localities/localities-list.spec.ts.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import LocalityList from "../../src/components/LocalityList.astro";
import type { ServedLocality } from "../../src/core/locality/served.ts";
import { collapseProblems } from "../responsive-rules.ts";

const TIZAYUCA: ServedLocality = {
  code: "13069",
  name: "Tizayuca",
  slug: "tizayuca",
  state: { code: "13", name: "Hidalgo", slug: "hidalgo" },
  timeZone: "America/Mexico_City",
  contactWhatsapp: "7719990001",
  othersActive: true,
  seat: { latitude: 19.8410889, longitude: -98.9815842 },
};

const OTHER: ServedLocality = {
  code: "98001",
  name: "Pueblo Uno",
  slug: "pueblo-uno",
  state: { code: "98", name: "Estado de prueba 98", slug: "estado-de-prueba-98" },
  timeZone: "America/Mexico_City",
  contactWhatsapp: "7719990002",
  othersActive: true,
  seat: null,
};

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function render(suggested?: ServedLocality | null): Promise<string> {
  return container.renderToString(LocalityList, {
    props: { localities: [TIZAYUCA, OTHER], suggested },
  });
}

/** The text of a fragment, with its blanks collapsed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every entry of the list, as [href, text, suggested]. */
function entries(html: string): [string, string, boolean][] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes = "", inner]) => [
    /href="([^"]*)"/.exec(attributes)?.[1]?.replace(/&amp;/g, "&") ?? "",
    text(inner ?? ""),
    /data-suggested="true"/.test(attributes),
  ]);
}

describe("With two or more active localities the root lists them and never redirects by location (v2)", () => {
  // Scenario: the list
  it("lists every locality with its municipality and state, each leading to its home", async () => {
    const html = await render();

    expect(text(/<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "")).toBe(
      "¿En qué municipio buscas?",
    );
    expect(entries(html)).toEqual([
      ["/?elegir=hidalgo/tizayuca", "Tizayuca Hidalgo", false],
      ["/?elegir=estado-de-prueba-98/pueblo-uno", "Pueblo Uno Estado de prueba 98", false],
    ]);
  });

  it("sends no script and uses no class that blocks the responsive collapse", async () => {
    const html = await render(TIZAYUCA);

    expect(html).not.toMatch(/<script\b/i);
    const classes = [...html.matchAll(/class="([^"]*)"/g)].map(([, value = ""]) => value);
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.flatMap(collapseProblems)).toEqual([]);
  });
});

describe("Geolocation is only a suggestion of the nearest locality (v2)", () => {
  // Scenario: the nearest is highlighted
  it("the suggested locality is visibly highlighted, and every entry stays a choice", async () => {
    const html = await render(TIZAYUCA);

    expect(entries(html)).toEqual([
      ["/?elegir=hidalgo/tizayuca", "Te queda más cerca Tizayuca Hidalgo", true],
      ["/?elegir=estado-de-prueba-98/pueblo-uno", "Pueblo Uno Estado de prueba 98", false],
    ]);
  });

  // Scenario: no location
  it("without a suggestion no locality is highlighted", async () => {
    for (const html of [await render(), await render(null)]) {
      expect(html).not.toContain("data-suggested");
      expect(html).not.toContain("Te queda más cerca");
    }
  });
});
