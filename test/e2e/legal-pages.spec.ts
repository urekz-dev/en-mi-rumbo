// Scenarios of docs/specs/legal-pages.md on the built site, served by
// `astro preview` in workerd: the two legal pages answer from the files the
// build prerendered, inside the layout, with the draft mark, their links and
// no locality, also with JavaScript off. The layout rules (390px, touch
// areas, brand) run on them in test/e2e/surfaces.spec.ts, which reaches them
// through the footer; the local robots behaviour is in test/e2e/robots.spec.ts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/** The file the build prerendered for a page. */
const prerenderedFile = (path: string) =>
  fileURLToPath(new URL(`../../dist/client${path}.html`, import.meta.url));

const PAGES = [
  {
    path: "/aviso-de-privacidad",
    title: "Aviso de privacidad — enmirumbo",
    h1: "Aviso de privacidad",
    updated: "Versión 2 · Última actualización: [FECHA DE PUBLICACIÓN]",
    link: { name: "Términos y condiciones", href: "/terminos" },
  },
  {
    path: "/terminos",
    title: "Términos y condiciones — enmirumbo",
    h1: "Términos y condiciones",
    updated: "Última actualización: [FECHA DE PUBLICACIÓN]",
    link: { name: "Aviso de privacidad", href: "/aviso-de-privacidad" },
  },
] as const;

const DRAFT_MARK =
  "Ojo: este texto todavía es un borrador. Nos faltan los datos que ves entre corchetes y la revisión legal antes de que el directorio se lance.";

for (const legal of PAGES) {
  // Scenarios: the owner opens the privacy notice; the resident opens the terms;
  // draft mark visible
  test(`${legal.path} answers 200 inside the layout, with its draft mark and its date`, async ({
    page,
  }) => {
    const response = await page.goto(legal.path);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(legal.title);
    await expect(page.getByRole("banner").getByRole("link", { name: "enmirumbo" })).toHaveAttribute(
      "href",
      "/",
    );
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(legal.h1);
    await expect(main.getByTestId("draft-mark")).toHaveText(DRAFT_MARK);
    await expect(main.getByTestId("last-updated")).toHaveText(legal.updated);
    await expect(main.getByRole("link", { name: legal.link.name, exact: true })).toHaveAttribute(
      "href",
      legal.link.href,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  // Scenario: no locality named (v2)
  test(`${legal.path} names no locality, and its footer has no line for the neighbours`, async ({
    page,
  }) => {
    await page.goto(legal.path);

    const text = [
      await page.title(),
      (await page.locator('meta[name="description"]').getAttribute("content")) ?? "",
      await page.locator("body").innerText(),
    ].join("\n");
    expect(text).not.toMatch(/tizayuca|hidalgo/i);
    await expect(page.getByTestId("neighbours-line")).toHaveCount(0);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Aviso de privacidad" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Términos y condiciones" })).toBeVisible();
  });

  // Scenario: the pages are static (v2): what answers is the file the build wrote
  test(`${legal.path} is served from the prerendered file, at its address without a slash`, async ({
    request,
  }) => {
    const prerendered = readFileSync(prerenderedFile(legal.path), "utf8");
    const response = await request.get(legal.path);

    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(prerendered);
    const slash = await request.get(`${legal.path}/`, { maxRedirects: 0 });
    expect(slash.status()).toBe(307);
    expect(slash.headers()["location"]).toBe(legal.path);
  });
}

// Scenario: no client JavaScript (the content displays in full without it)
test.describe("with JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("both pages display their whole content", async ({ page }) => {
    await page.goto("/aviso-de-privacidad");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(11);
    await expect(page.getByRole("heading", { name: "Tus derechos ARCO" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Términos y condiciones" }).click();
    await expect(page).toHaveURL(/\/terminos$/);
    await expect(page.getByRole("heading", { name: "Ley aplicable" })).toBeVisible();
  });
});

// Scenario: the Turnstile addendum (v2): the link leaves the site in a new tab
test("the notice links to Cloudflare's Turnstile privacy addendum in a new tab", async ({
  page,
}) => {
  await page.goto("/aviso-de-privacidad");

  const addendum = page.getByRole("link", { name: /Anexo de privacidad de Turnstile/ });
  await expect(addendum).toHaveAttribute(
    "href",
    "https://www.cloudflare.com/turnstile-privacy-policy/",
  );
  await expect(addendum).toHaveAttribute("target", "_blank");
  await expect(addendum).toHaveAttribute("rel", "noopener noreferrer");
});
