// Scenarios of docs/specs/public-directory.md with two active localities,
// Tizayuca and a fictitious second one (./second-locality.ts):
// - "With two or more active localities the root lists them and never redirects by location (v2)"
// - "Geolocation is only a suggestion of the nearest locality (v2)"
// - "The chosen locality is remembered in a cookie that holds only its slug (v2)"
// - "The pages of a locality offer to change municipality while two or more are active (v2)"
// - "There is no short alias of a locality (v2)"
// The project "phone, two localities" of playwright.config.ts runs it, and the
// crawls of surfaces.spec.ts and internal-links.spec.ts again, through the
// list. `astro preview` gives each request the approximate location of the
// machine that runs it, unless the request carries Miniflare's `MF-CF-Blob`
// header, the JSON of the `cf` object the Worker sees: these tests send one on
// every request, empty (no location) unless a test places the request
// somewhere. Tizayuca's seat comes from the migrations and the second
// locality's is made up.
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { SECOND_LOCALITY, setSecondLocalitySeat } from "./second-locality.ts";

const TIZAYUCA = "/hidalgo/tizayuca";
const SECOND = `/${SECOND_LOCALITY.state.slug}/${SECOND_LOCALITY.slug}`;
const CHOOSE_TIZAYUCA = "/?elegir=hidalgo/tizayuca";
const CHOOSE_SECOND = `/?elegir=${SECOND_LOCALITY.state.slug}/${SECOND_LOCALITY.slug}`;

/** Headers that make `astro preview` locate the request with this `cf` object. */
const locatedAt = (cf: Record<string, string>) => ({ "MF-CF-Blob": JSON.stringify(cf) });

/** A request that carries no approximate location. */
const NOWHERE = locatedAt({});

/** A request that Cloudflare would locate in the United States. */
const IN_THE_UNITED_STATES = locatedAt({
  country: "US",
  region: "California",
  city: "Mountain View",
  latitude: "37.38600",
  longitude: "-122.08380",
});

/** A request from Pachuca de Soto, about 40 km from Tizayuca's seat. */
const NEAR_TIZAYUCA = locatedAt({
  country: "MX",
  region: "Hidalgo",
  city: "Pachuca",
  latitude: "20.10110",
  longitude: "-98.75910",
});

/** A request next to the second locality's made-up seat. */
const NEAR_THE_SECOND = locatedAt({ latitude: "21.10000", longitude: "-101.10000" });

test.use({ extraHTTPHeaders: NOWHERE });

/** The entries of the list, as [accessible name, href]. */
async function entries(page: Page): Promise<[string, string][]> {
  return page
    .getByTestId("localities")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => [
        (link as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
        link.getAttribute("href") ?? "",
      ]),
    );
}

/** The list as the root shows it, in the order of the state and municipality slugs. */
const LIST: [string, string][] = [
  [`${SECOND_LOCALITY.name} ${SECOND_LOCALITY.state.name}`, CHOOSE_SECOND],
  ["Tizayuca Hidalgo", CHOOSE_TIZAYUCA],
];

/** Whether an answer is the list of localities. */
async function isTheList(response: APIResponse): Promise<boolean> {
  const html = await response.text();
  return html.includes(`href="${CHOOSE_TIZAYUCA}"`) && html.includes(`href="${CHOOSE_SECOND}"`);
}

test.describe("With two or more active localities the root lists them and never redirects by location (v2)", () => {
  // Scenario: the list
  test("the root lists both localities, each leading to its home", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿En qué municipio buscas?");
    expect(await entries(page)).toEqual(LIST);
    // The page belongs to no locality: the layout names none.
    await expect(page).toHaveTitle("enmirumbo");
    await expect(page.getByTestId("neighbours-line")).toHaveCount(0);
  });

  test("what the root answers depends on each visitor, so nothing keeps it", async ({
    request,
  }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  // Scenario: a crawler gets the same list
  test("a request located in the United States gets the same list, not a redirect", async ({
    request,
  }) => {
    const response = await request.get("/", { headers: IN_THE_UNITED_STATES, maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(await isTheList(response)).toBe(true);
  });
});

test.describe("Geolocation is only a suggestion of the nearest locality (v2)", () => {
  /** The entries of the list that are highlighted, by their name. */
  async function highlighted(page: Page): Promise<string[]> {
    return page
      .locator("[data-suggested]")
      .evaluateAll((links) => links.map((link) => (link as HTMLElement).innerText));
  }

  // Scenario: the nearest is highlighted
  test("a request near Tizayuca sees Tizayuca highlighted, and both still listed", async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders(NEAR_TIZAYUCA);
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/");
    expect((await highlighted(page)).map((text) => text.replace(/\s+/g, " "))).toEqual([
      "Te queda más cerca Tizayuca Hidalgo",
    ]);
    await expect(page.getByTestId("localities").getByRole("link")).toHaveCount(2);
    // The suggestion is not a choice: nothing is stored.
    expect(await page.context().cookies()).toEqual([]);
  });

  test("a request near the other locality sees that one highlighted", async ({ page }) => {
    await page.setExtraHTTPHeaders(NEAR_THE_SECOND);
    await page.goto("/");

    expect(await highlighted(page)).toHaveLength(1);
    await expect(page.locator("[data-suggested]")).toHaveAttribute("href", CHOOSE_SECOND);
  });

  // Scenario: no location
  test("a request with no location sees no highlight", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-suggested]")).toHaveCount(0);
    await expect(page.getByText("Te queda más cerca")).toHaveCount(0);
  });

  // Scenario: a locality without coordinates
  test("a locality without coordinates is listed but never highlighted", async ({ request }) => {
    await setSecondLocalitySeat(false);
    try {
      const response = await request.get("/", { headers: NEAR_THE_SECOND });
      const html = await response.text();

      expect(await isTheList(response)).toBe(true);
      // Tizayuca, the only locality with coordinates, is the nearest one placed.
      expect(html.match(/<a\b[^>]*data-suggested[^>]*>/g)?.join("")).toContain(
        `href="${CHOOSE_TIZAYUCA}"`,
      );
    } finally {
      await setSecondLocalitySeat(true);
    }
  });

  // Scenario: the location is not stored
  test("visiting the list from anywhere leaves no cookie", async ({ page, context }) => {
    await page.setExtraHTTPHeaders(IN_THE_UNITED_STATES);
    await page.goto("/");

    expect(await context.cookies()).toEqual([]);
  });
});

test.describe("The chosen locality is remembered in a cookie that holds only its slug (v2)", () => {
  // Scenario: choosing
  test("choosing Tizayuca stores only its slug and leads to its home", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Tizayuca Hidalgo" }).click();

    await expect(page).toHaveURL(TIZAYUCA);
    const cookies = await context.cookies();
    expect(cookies).toEqual([
      expect.objectContaining({
        name: "locality",
        value: "tizayuca",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        // `astro preview` serves http; on https the cookie is Secure.
        secure: false,
      }),
    ]);
    const days = ((cookies[0]?.expires ?? 0) - Date.now() / 1000) / 86_400;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThanOrEqual(365);
  });

  test("the choice is a 302 that sets the cookie and that nothing keeps", async ({ request }) => {
    const response = await request.get(CHOOSE_TIZAYUCA, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe(TIZAYUCA);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBe(
      "locality=tizayuca; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax",
    );
  });

  // Scenario: coming back
  test("later visits to the root go to the chosen locality with a 302 nothing keeps", async ({
    page,
    request,
  }) => {
    const response = await request.get("/", {
      headers: { Cookie: "locality=tizayuca" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe(TIZAYUCA);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();

    await page.goto(CHOOSE_SECOND);
    await page.goto("/");
    await expect(page).toHaveURL(SECOND);
  });

  // Scenario: a stale cookie
  for (const value of ["pachuca-de-soto", "no-existe", "Tizayuca", "hidalgo%2Ftizayuca"]) {
    test(`a cookie with "${value}" is ignored and the list shown`, async ({ request }) => {
      const response = await request.get("/", {
        headers: { Cookie: `locality=${value}` },
        maxRedirects: 0,
      });

      expect(response.status()).toBe(200);
      expect(await isTheList(response)).toBe(true);
    });
  }

  test("a choice of a locality that is not active stores nothing and shows the list", async ({
    request,
  }) => {
    for (const path of [
      "/?elegir=hidalgo/pachuca-de-soto",
      "/?elegir=jalisco/tizayuca",
      "/?elegir=tizayuca",
      "/?elegir=https://evil.example/",
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status(), path).toBe(200);
      expect(response.headers()["set-cookie"], path).toBeUndefined();
      expect(await isTheList(response), path).toBe(true);
    }
  });
});

test.describe("The pages of a locality offer to change municipality while two or more are active (v2)", () => {
  test("every page of a locality links to the list, which shows even after choosing", async ({
    page,
    context,
  }) => {
    await page.goto(CHOOSE_TIZAYUCA);
    await expect(page).toHaveURL(TIZAYUCA);
    const change = page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Cambiar de municipio" });
    await expect(change).toHaveAttribute("href", "/?cambiar");

    await change.click();
    await expect(page).toHaveURL("/?cambiar");
    expect(await entries(page)).toEqual(LIST);

    // Choosing the other locality replaces the cookie.
    await page.getByRole("link", { name: SECOND_LOCALITY.name }).click();
    await expect(page).toHaveURL(SECOND);
    expect((await context.cookies()).map(({ name, value }) => [name, value])).toEqual([
      ["locality", SECOND_LOCALITY.slug],
    ]);
    await page.goto("/");
    await expect(page).toHaveURL(SECOND);
  });

  test("the other locality offers it too, and a page outside a locality does not", async ({
    page,
  }) => {
    await page.goto(SECOND);
    await expect(page.getByRole("link", { name: "Cambiar de municipio" })).toBeVisible();

    for (const path of ["/", "/no-existe", "/admin"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Cambiar de municipio" }), path).toHaveCount(0);
    }
  });
});

test.describe("There is no short alias of a locality (v2)", () => {
  for (const path of ["/tizayuca", `/${SECOND_LOCALITY.slug}`, "/hidalgo"]) {
    test(`${path} answers 404 with two active localities`, async ({ request }) => {
      const response = await request.get(path, {
        headers: { Cookie: "locality=tizayuca" },
        maxRedirects: 0,
      });

      expect(response.status()).toBe(404);
    });
  }
});
