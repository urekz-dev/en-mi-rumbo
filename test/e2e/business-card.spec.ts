// Scenarios of docs/specs/public-directory.md for the card page, on the built
// site with the seeded directory of Tizayuca: "Business card at its own URL
// with the registered information and the verified seal", "An outdated card
// URL redirects to its current URL (v2)", "Only what is published is shown",
// "Public URLs carry the state and the municipality (v2)", "Contact buttons on
// the card with WhatsApp as the main action", "An edit awaiting review does
// not show through on any public surface", "The card looks good when shared
// over WhatsApp or Facebook", "Each published card emits Schema.org
// LocalBusiness", "The card view is measured on its own, without custom
// instrumentation" and "Directory in Server Components, mobile-first and
// usable without JavaScript". The seed's cards are fixed
// (src/core/db/seed/businesses.ts). The layout rules of every card (390px,
// metadata, brand) are checked by surfaces.spec.ts, which crawls the
// sitemap, and its links by internal-links.spec.ts.
import { expect, test, type Page } from "@playwright/test";
import {
  addOtherLocalityCard,
  addPendingEdit,
  OTHER_CARD,
  PROPOSED,
  removeOtherLocalityCard,
  removePendingEdits,
} from "./business-card-fixtures.ts";

const SITE_URL = "http://localhost:4321";
const CARDS = "/hidalgo/tizayuca/negocio";
/** The seeded card with every optional field but the photo. */
const COMPLETE = `${CARDS}/plomeria-los-fontaneros-ficticios-b5q68b2e72`;
/** The seeded card with only the required fields. */
const MINIMAL = `${CARDS}/cocina-dona-chela-de-mentiras-46ydv7h97a`;
const WHATSAPP_MESSAGE = "Hola, te vi en enmirumbo. ¿Me das informes?";

/** The parsed JSON-LD blocks of the page. */
async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block) as Record<string, unknown>);
}

test.describe("Business card at its own URL with the registered information and the verified seal", () => {
  // Scenario: complete card
  test("a complete card shows its name as the heading, the seal and everything it registered", async ({
    page,
  }) => {
    const response = await page.goto(COMPLETE);

    expect(response?.status()).toBe(200);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Plomería Los Fontaneros Ficticios",
    );
    await expect(main.getByRole("heading")).toHaveCount(1);
    // The seal's check mark is decorative.
    await expect(main.getByText("Negocio verificado")).toBeVisible();
    for (const text of [
      "A domicilio",
      "Huicalco",
      "Plomería, destape de drenajes y bombas de agua",
      "Calle Inventada 123, junto a la tiendita de la esquina (referencia de mentira)",
      "Horario: Lunes a sábado de 9 de la mañana a 7 de la tarde",
    ]) {
      await expect(main.getByText(text, { exact: true }), text).toBeVisible();
    }
    // Its trade, with its phrase, as a link to the trade's page.
    await expect(
      main.getByRole("navigation", { name: "Lo que hace este negocio" }).getByRole("link"),
    ).toHaveText(["Plomería"]);
  });

  // Scenario: card of a business that filled in only the required fields
  test("a card with only the required fields shows its name, the seal, its zone and WhatsApp", async ({
    page,
  }) => {
    await page.goto(MINIMAL);

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Cocina Doña Chela de Mentiras",
    );
    await expect(main.getByText("Negocio verificado")).toBeVisible();
    await expect(main.getByText("Tizayuca Centro", { exact: true })).toBeVisible();
    // Besides its trade, the only link is WhatsApp.
    await expect(main.locator("a:not(nav a)")).toHaveText(["Enviar WhatsApp"]);
    await expect(main).not.toContainText(/Horario|Teléfono|A domicilio|No disponible/);
  });

  // Scenario: nonexistent card
  test("an identifier that does not exist answers 404 with the site's page", async ({ page }) => {
    const response = await page.goto(`${CARDS}/no-existe-zzzzzzzzzz`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});

test.describe("An outdated card URL redirects to its current URL (v2)", () => {
  // Scenario: old link after a name change
  for (const [scenario, segment] of [
    ["an earlier name", "plomeria-el-nombre-de-antes-b5q68b2e72"],
    ["the identifier alone", "b5q68b2e72"],
    ["the name with its accents", "plomer%C3%ADa-los-fontaneros-ficticios-b5q68b2e72"],
  ] as const) {
    test(`${scenario}: a 301 to the current URL, kept for an hour at most`, async ({ request }) => {
      const response = await request.get(`${CARDS}/${segment}`, { maxRedirects: 0 });

      expect(response.status()).toBe(301);
      expect(response.headers()["location"]).toBe(COMPLETE);
      expect(response.headers()["cache-control"]).toBe("max-age=3600");
    });
  }

  test("following it, the resident sees the card", async ({ page }) => {
    await page.goto(`${CARDS}/plomeria-el-nombre-de-antes-b5q68b2e72`);

    await expect(page).toHaveURL(COMPLETE);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Plomería Los Fontaneros Ficticios",
    );
  });
});

test.describe("Only what is published is shown", () => {
  test.beforeAll(async () => {
    await addOtherLocalityCard();
  });
  test.afterAll(async () => {
    await removeOtherLocalityCard();
  });

  // Scenarios: card of an unpublished business; the URL of an unpublished
  // card gives nothing away
  test("a card in review, a rejected one and one of another locality answer the same 404 as one that never existed", async ({
    request,
  }) => {
    const never = await request.get(`${CARDS}/no-existe-zzzzzzzzzz`, { maxRedirects: 0 });
    const body = await never.text();
    expect(never.status()).toBe(404);

    for (const [scenario, segment, name] of [
      ["in review", "barberia-el-corte-imaginario-c9yaseemtj", "Barbería El Corte Imaginario"],
      ["rejected", "taller-fantasma-de-mentiras-vj47rbgwgu", "Taller Fantasma de Mentiras"],
      // Public URLs carry the state and the municipality (v2): a card lives
      // only under its own locality.
      ["of another locality", OTHER_CARD.segment, OTHER_CARD.name],
      ["of another locality, by its identifier", OTHER_CARD.id, OTHER_CARD.name],
    ] as const) {
      const response = await request.get(`${CARDS}/${segment}`, { maxRedirects: 0 });
      expect(response.status(), scenario).toBe(404);
      const text = await response.text();
      expect(text, scenario).toBe(body);
      expect(text, scenario).not.toContain(name);
    }
  });
});

test.describe("Contact buttons on the card with WhatsApp as the main action", () => {
  // Scenario: WhatsApp as the main action; the prefilled message
  test("Enviar WhatsApp opens the business's conversation with the message, in a new tab", async ({
    page,
  }) => {
    await page.goto(COMPLETE);

    const whatsapp = page.getByRole("link", {
      name: "Enviar WhatsApp a Plomería Los Fontaneros Ficticios",
    });
    await expect(whatsapp).toHaveText("Enviar WhatsApp");
    const href = new URL((await whatsapp.getAttribute("href")) ?? "");
    expect(`${href.origin}${href.pathname}`).toBe("https://wa.me/527719990101");
    expect(href.searchParams.get("text")).toBe(WHATSAPP_MESSAGE);
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("the main action is the most prominent control: the widest and the only green one", async ({
    page,
  }) => {
    await page.goto(COMPLETE);

    const main = page.getByRole("main");
    const whatsapp = main.getByRole("link", { name: /^Enviar WhatsApp/ });
    const width = (await whatsapp.boundingBox())?.width ?? 0;
    for (const other of await main.getByRole("link").all()) {
      if ((await other.innerText()) === "Enviar WhatsApp") continue;
      expect((await other.boundingBox())?.width ?? 0).toBeLessThanOrEqual(width);
      const background = await other.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      expect(background).not.toBe(
        await whatsapp.evaluate((element) => getComputedStyle(element).backgroundColor),
      );
    }
  });

  // Scenario: buttons that depend on what was registered
  test("the complete card adds Llamar, Cómo llegar and its page, each where it should lead", async ({
    page,
  }) => {
    await page.goto(COMPLETE);
    const main = page.getByRole("main");

    // The contact buttons, apart from the links of its trades.
    await expect(main.locator("a:not(nav a)")).toHaveText([
      "Enviar WhatsApp",
      "Llamar",
      "Cómo llegar",
      "Ver su página (facebook.example)",
    ]);
    const call = main.getByRole("link", { name: "Llamar" });
    await expect(call).toHaveAttribute("href", "tel:+527719990151");
    expect(await call.getAttribute("target")).toBeNull();
    const directions = main.getByRole("link", { name: "Cómo llegar" });
    const query = new URL((await directions.getAttribute("href")) ?? "").searchParams.get("query");
    expect(query).toBe(
      "Calle Inventada 123, junto a la tiendita de la esquina (referencia de mentira), Huicalco, Tizayuca, Hidalgo",
    );
    await expect(directions).toHaveAttribute("target", "_blank");
    await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
  });

  // Scenario: the link to the registered page does not promise Facebook
  test("a page that is not Facebook's shows its real domain", async ({ page }) => {
    await page.goto(`${CARDS}/academia-halcones-de-mentiras-s7hmtzvsk3`);

    const link = page.getByRole("link", { name: "Ver su página (halcones-ficticios.example)" });
    await expect(link).toHaveAttribute("href", "https://halcones-ficticios.example/club");
    await expect(page.getByRole("main")).not.toContainText(/facebook/i);
  });
});

test.describe("An edit awaiting review does not show through on any public surface", () => {
  const VETERINARIA = `${CARDS}/veterinaria-patitas-ficticias-5dncvpyj8k`;

  test.afterAll(async () => {
    await removePendingEdits("5dncvpyj8k");
  });

  // Scenarios: the card keeps showing what is published; nothing gives away
  // that changes are waiting
  test("the card keeps its published data, and its response is the same as without the edit", async ({
    request,
  }) => {
    const before = await (await request.get(VETERINARIA)).text();
    await addPendingEdit("5dncvpyj8k");

    const response = await request.get(VETERINARIA, { maxRedirects: 0 });
    const after = await response.text();
    expect(response.status()).toBe(200);
    expect(after).toBe(before);
    for (const value of [...Object.values(PROPOSED), "7719990187", "propuest"]) {
      expect(after).not.toContain(value);
    }
  });
});

test.describe("The card looks good when shared over WhatsApp or Facebook", () => {
  // Scenarios: card without a photo; the image is declared with an absolute
  // URL; the preview does not hand out the number
  test("its preview has its own title and description, its absolute URL and the brand image of its locality", async ({
    page,
  }) => {
    await page.goto(COMPLETE);
    const meta = (property: string) => page.locator(`meta[property="${property}"]`);

    await expect(page).toHaveTitle(
      "Plomería Los Fontaneros Ficticios en Huicalco, Tizayuca — enmirumbo",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Plomería, destape de drenajes y bombas de agua",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE_URL}${COMPLETE}`,
    );
    await expect(meta("og:url")).toHaveAttribute("content", `${SITE_URL}${COMPLETE}`);
    await expect(meta("og:title")).toHaveAttribute("content", await page.title());
    await expect(meta("og:site_name")).toHaveAttribute("content", "enmirumbo");
    await expect(meta("og:locale")).toHaveAttribute("content", "es_MX");
    await expect(meta("og:image")).toHaveAttribute("content", /^http:\/\/localhost:4321\/.*\.png$/);
    await expect(meta("og:image:alt")).toHaveAttribute(
      "content",
      "enmirumbo, el directorio de negocios de Tizayuca, Hidalgo",
    );
    const head = await page.locator("head").innerHTML();
    expect(head).not.toMatch(/7719990101|7719990151/);
  });

  // Own title and description, scenario: card without "¿Qué ofreces?"
  test("a card that wrote nothing in ¿Qué ofreces? describes itself with its name and zone", async ({
    page,
  }) => {
    await page.goto(MINIMAL);

    await expect(page).toHaveTitle("Cocina Doña Chela de Mentiras en Tizayuca Centro — enmirumbo");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Cocina Doña Chela de Mentiras en Tizayuca Centro. Negocio verificado que contactas directo por WhatsApp.",
    );
  });
});

test.describe("Each published card emits Schema.org LocalBusiness", () => {
  // Scenarios: published card with structured data; never the exact address
  // nor the number
  test("one LocalBusiness block with its name, URL, zone, locality, category and trade, and no address or number", async ({
    page,
  }) => {
    await page.goto(COMPLETE);

    expect(await jsonLd(page)).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Plomería Los Fontaneros Ficticios",
        url: `${SITE_URL}${COMPLETE}`,
        description: "Plomería, destape de drenajes y bombas de agua",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Huicalco",
          addressLocality: "Tizayuca",
          addressRegion: "Hidalgo",
          addressCountry: "MX",
        },
        knowsAbout: ["Servicios del hogar", "Plomería"],
      },
    ]);
  });

  // Scenario: business without a catalogue zone
  test('a card with the zone "Otra" declares the locality and invents no zone', async ({
    page,
  }) => {
    await page.goto(`${CARDS}/abarrotes-la-esperanza-inventada-697wvtkk7e`);

    await expect(
      page.getByText("Privada Los Colibríes Imaginarios", { exact: true }),
    ).toBeVisible();
    const [block] = await jsonLd(page);
    expect(block?.["address"]).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Tizayuca",
      addressRegion: "Hidalgo",
      addressCountry: "MX",
    });
  });

  // Scenario: only on published cards
  test("a 404 has no structured data", async ({ page }) => {
    await page.goto(`${CARDS}/barberia-el-corte-imaginario-c9yaseemtj`);

    expect(await jsonLd(page)).toEqual([]);
  });
});

test.describe("Directory in Server Components, mobile-first and usable without JavaScript", () => {
  // Scenario: no client-side JS; the card adds no instrumentation
  test("the only script of the card is its data block, which the content security policy lets be", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(COMPLETE);

    expect(response?.headers()["content-security-policy"]).toMatch(/script-src 'self'/);
    await expect(page.locator("script")).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    expect(await page.content()).not.toContain("data-umami");
    expect(errors).toEqual([]);
  });

  // Scenario: phone at 390px
  test("on a 390px phone every control of the card measures at least 44px and nothing scrolls sideways", async ({
    page,
  }) => {
    expect(page.viewportSize()?.width).toBe(390);
    for (const path of [COMPLETE, MINIMAL]) {
      await page.goto(path);
      for (const link of await page.getByRole("main").getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(
          Math.min(box?.width ?? 0, box?.height ?? 0),
          await link.innerText(),
        ).toBeGreaterThanOrEqual(44);
      }
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, path).toBeLessThanOrEqual(clientWidth);
    }
  });

  test.describe("with JavaScript disabled", () => {
    test.use({ javaScriptEnabled: false });

    // Scenario: navigation without JavaScript
    test("the card shows in full and its buttons are plain links", async ({ page }) => {
      await page.goto(COMPLETE);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Plomería Los Fontaneros Ficticios",
      );
      await expect(page.getByRole("link", { name: /^Enviar WhatsApp/ })).toHaveAttribute(
        "href",
        /^https:\/\/wa\.me\/527719990101\?text=/,
      );
    });
  });
});
