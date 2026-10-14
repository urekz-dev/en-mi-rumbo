// Scenarios of docs/specs/base-layout.md for the global layout, rendered with
// Astro's Container API and a fixture locality in Astro.locals, as the
// middleware sets it on the routes under /{estado}/{municipio}/ (ADR 0007).
// The served pages, their sizes and their touch areas are tested end to end in
// test/e2e/surfaces.spec.ts and test/e2e/not-found.spec.ts.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import type { ServedLocality } from "../../src/core/locality/served.ts";
import BaseLayout from "../../src/layouts/BaseLayout.astro";
import NotFound from "../../src/pages/404.astro";
import { attachedLocalityNames, brandFindings } from "../brand-rules.ts";
import { env } from "./cloudflare-workers.ts";

const TIZAYUCA: ServedLocality = {
  code: "13069",
  name: "Tizayuca",
  slug: "tizayuca",
  state: { code: "13", name: "Hidalgo", slug: "hidalgo" },
  timeZone: "America/Mexico_City",
  contactWhatsapp: "7719990001",
};

const OTHER: ServedLocality = {
  code: "98001",
  name: "Pueblo Uno",
  slug: "pueblo-uno",
  state: { code: "98", name: "Estado de prueba 98", slug: "estado-de-prueba-98" },
  timeZone: "America/Mexico_City",
  contactWhatsapp: "7719990002",
};

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

afterEach(() => {
  for (const key of Object.keys(env)) delete env[key as keyof Env];
  env.ENVIRONMENT = "local";
});

/**
 * What the middleware leaves in Astro.locals. The adapter's own locals
 * (cfContext) exist only in workerd, and the layout does not read them.
 */
function localsWith(locality: ServedLocality | undefined): App.Locals {
  return (locality === undefined ? {} : { locality }) as App.Locals;
}

/** The 404 page, a page with no title of its own, as a whole document. */
function renderNotFound(locality?: ServedLocality): Promise<string> {
  return container.renderToString(NotFound, {
    partial: false,
    locals: localsWith(locality),
  });
}

/** The layout around a page with its own title and head elements. */
function renderPage(locality: ServedLocality | undefined, title?: string): Promise<string> {
  return container.renderToString(BaseLayout, {
    partial: false,
    props: { title },
    slots: {
      default: "<h1>Servicios del hogar</h1>",
      head: '<meta name="robots" content="noindex, nofollow">',
    },
    locals: localsWith(locality),
  });
}

/** The text a person reads, one line per block, like innerText. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(
      /<\/?(?:p|div|h[1-6]|li|ul|ol|header|footer|main|section|nav|title|br)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&");
}

/** The contents of the first element named `tag`. */
function element(html: string, tag: string): string {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(html)?.[1] ?? "";
}

function meta(html: string, attribute: "name" | "property", value: string): string | undefined {
  const tag = new RegExp(`<meta ${attribute}="${value}"[^>]*>`).exec(html)?.[0];
  return tag === undefined ? undefined : /content="([^"]*)"/.exec(tag)?.[1];
}

/** Every link of a fragment, as [href, text]. */
function links(html: string): [string, string][] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href, text]) => [href ?? "", visibleText(text ?? "").trim()],
  );
}

describe("Global layout with header and footer on every page", () => {
  // Scenario: header with the wordmark
  it("the header shows the wordmark alone, linked to the home of the locality", async () => {
    const header = element(await renderNotFound(TIZAYUCA), "header");

    expect(links(header)).toEqual([["/hidalgo/tizayuca", "enmirumbo"]]);
    expect(visibleText(header)).not.toMatch(/tizayuca|hidalgo/i);
  });

  it("outside a locality the wordmark leads to the root", async () => {
    const header = element(await renderNotFound(), "header");

    expect(links(header)).toEqual([["/", "enmirumbo"]]);
  });

  // Scenarios: hyperlocal positioning stays visible outside the header; the
  // footer closing line did not change with the rebrand
  it("the footer reads the line for the neighbours of the locality, word for word", async () => {
    const footer = visibleText(element(await renderNotFound(TIZAYUCA), "footer"));

    expect(footer).toContain("\nHecho para los vecinos de Tizayuca, Hidalgo.\n");
  });

  // Scenario: footer with the legal links and no dead links. The legal links
  // arrive with their pages (EMR-31): until then the footer links nowhere.
  it("the footer identifies the site and has no dead links", async () => {
    const footer = element(await renderNotFound(TIZAYUCA), "footer");

    expect(visibleText(footer)).toMatch(/^\s*enmirumbo\n/);
    expect(links(footer)).toEqual([]);
  });

  it("outside a locality the footer names no locality but keeps the brand", async () => {
    const footer = element(await renderNotFound(), "footer");

    expect(visibleText(footer)).not.toContain("Hecho para los vecinos");
    expect(visibleText(footer)).toMatch(/^\s*enmirumbo\n/);
  });
});

describe("Server Component with a document in es-MX and base metadata", () => {
  // Scenario: document in Mexican Spanish with metadata
  it("the document is in es-MX and its title and description name the locality", async () => {
    const html = await renderNotFound(TIZAYUCA);

    expect(html).toMatch(/^<!DOCTYPE html><html lang="es-MX"[ >]/i);
    expect(html).toContain('<meta charset="utf-8">');
    expect(meta(html, "name", "viewport")).toBe("width=device-width, initial-scale=1");
    expect(element(html, "title")).toBe("enmirumbo — Encuentra negocios y servicios en Tizayuca");
    expect(meta(html, "name", "description")).toBe(
      "Encuentra negocios, servicios y deporte en Tizayuca y contáctalos directo por WhatsApp. Registro gratis para negocios locales.",
    );
  });

  // Scenario: a page with its own title carries the brand at the end
  it("a page with its own title carries the brand at the end, and adds its own head elements", async () => {
    const html = await renderPage(TIZAYUCA, "Servicios del hogar en Tizayuca");

    expect(element(html, "title")).toBe("Servicios del hogar en Tizayuca — enmirumbo");
    expect(meta(html, "name", "robots")).toBe("noindex, nofollow");
  });

  // Scenario: the card shared through WhatsApp arrives with the new brand
  // (the identity part; the brand image and absolute URLs come with SEO)
  it("every page declares the identity of the share preview", async () => {
    const html = await renderPage(undefined);

    expect(meta(html, "property", "og:site_name")).toBe("enmirumbo");
    expect(meta(html, "property", "og:locale")).toBe("es_MX");
    expect(meta(html, "property", "og:type")).toBe("website");
  });

  it("outside a locality the title is the brand alone and there is no description", async () => {
    const html = await renderNotFound();

    expect(element(html, "title")).toBe("enmirumbo");
    expect(meta(html, "name", "description")).toBeUndefined();
  });

  // Scenario: no client JS in the layout
  it("the layout sends no script", async () => {
    expect(await renderNotFound(TIZAYUCA)).not.toMatch(/<script\b/i);
    expect(await renderPage(TIZAYUCA, "Una página")).not.toMatch(/<script\b/i);
  });
});

describe("Phone number auto-detection is turned off (v2)", () => {
  // Scenario: the meta tag
  it("the head turns off phone number detection", async () => {
    expect(meta(await renderNotFound(), "name", "format-detection")).toBe("telephone=no");
    expect(meta(await renderPage(TIZAYUCA, "Una página"), "name", "format-detection")).toBe(
      "telephone=no",
    );
  });
});

describe("Base accessibility from PRD §8", () => {
  // Scenario: semantic structure
  it("the content is inside header, main and footer, with a single h1", async () => {
    const html = await renderNotFound(TIZAYUCA);

    for (const landmark of ["header", "main", "footer"]) {
      expect(html.match(new RegExp(`<${landmark}\\b`, "g")), landmark).toHaveLength(1);
    }
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(element(html, "main")).toContain("No encontramos esta página");
  });
});

describe("404 page in Spanish inside the layout", () => {
  // Scenario: unknown URL (inside a locality; the root's is tested end to end)
  it("inside a locality it answers 404, keeps the locality's footer and leads to its home", async () => {
    const response = await container.renderToResponse(NotFound, {
      partial: false,
      locals: localsWith(TIZAYUCA),
    });
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(element(html, "h1").trim()).toBe("No encontramos esta página");
    expect(visibleText(element(html, "main"))).toContain(
      "A lo mejor el negocio ya no está publicado o la dirección quedó mal escrita.",
    );
    expect(links(element(html, "main"))).toEqual([["/hidalgo/tizayuca", "Ir al inicio"]]);
    expect(visibleText(element(html, "footer"))).toContain(
      "Hecho para los vecinos de Tizayuca, Hidalgo.",
    );
  });
});

describe("Every text that names the locality reads it from the locality record (v2)", () => {
  // Scenario: the footer
  it("the footer of a page of Tizayuca", async () => {
    expect(visibleText(element(await renderNotFound(TIZAYUCA), "footer"))).toContain(
      "Hecho para los vecinos de Tizayuca, Hidalgo.",
    );
  });

  // Scenario: a second locality
  it("another locality shows its own municipality and state, and Tizayuca appears nowhere", async () => {
    const html = await renderNotFound(OTHER);

    expect(visibleText(element(html, "footer"))).toContain(
      "Hecho para los vecinos de Pueblo Uno, Estado de prueba 98.",
    );
    expect(element(html, "title")).toBe("enmirumbo — Encuentra negocios y servicios en Pueblo Uno");
    expect(meta(html, "name", "description")).toContain("deporte en Pueblo Uno y");
    expect(links(element(html, "header"))).toEqual([
      ["/estado-de-prueba-98/pueblo-uno", "enmirumbo"],
    ]);
    expect(html).not.toMatch(/tizayuca|hidalgo/i);
  });
});

describe("No surface of the site names the previous brand or attaches the locality to the name", () => {
  // Scenario: the brand stays alone (base-layout, "Every text that names the
  // locality reads it from the locality record (v2)")
  it.for([
    ["Tizayuca", TIZAYUCA],
    ["another locality", OTHER],
    ["no locality", undefined],
  ] as const)("with %s, no rendered text breaks the brand rules", async ([, locality]) => {
    for (const html of [await renderNotFound(locality), await renderPage(locality, "Una página")]) {
      const text = [
        visibleText(html),
        meta(html, "name", "description") ?? "",
        meta(html, "property", "og:site_name") ?? "",
      ].join("\n");
      expect(brandFindings(text)).toEqual([]);
      const names = locality === undefined ? [] : [locality.name, locality.state.name];
      expect(attachedLocalityNames(text, names)).toEqual([]);
    }
  });

  it("the check of rendered text catches the locality attached to the brand", () => {
    expect(attachedLocalityNames("Bienvenido a enmirumbo Pueblo Uno", ["Pueblo Uno"])).toEqual([
      "Pueblo Uno",
    ]);
    expect(attachedLocalityNames("enmirumbo, el directorio de Pueblo Uno", ["Pueblo Uno"])).toEqual(
      [],
    );
  });
});

// docs/specs/deployment.md, requirement "The dev footer names the branch and
// commit deployed (v2)"; src/lib/deploy-info.ts decides when.
describe("The dev footer names the branch and commit deployed (v2)", () => {
  const COMMIT = "167a5a8e0c4f3b2a1d9e8f7a6b5c4d3e2f1a0b9c";

  // Scenario: dev
  it("on dev the footer names the branch and the short commit", async () => {
    Object.assign(env, {
      ENVIRONMENT: "dev",
      DEPLOY_BRANCH: "EMR-27-layout",
      DEPLOY_COMMIT: COMMIT,
    });
    const footer = element(await renderNotFound(TIZAYUCA), "footer");

    expect(visibleText(footer).replace(/\s+/g, " ")).toContain(
      "Versión de prueba: rama EMR-27-layout, commit 167a5a8",
    );
    expect(footer).toContain(`title="${COMMIT}"`);
  });

  // Scenario: another environment
  it("elsewhere there is no deploy footer, even with both values", async () => {
    Object.assign(env, { ENVIRONMENT: "stage", DEPLOY_BRANCH: "main", DEPLOY_COMMIT: COMMIT });

    expect(await renderNotFound(TIZAYUCA)).not.toContain("Versión de prueba");
  });
});
