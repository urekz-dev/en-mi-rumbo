// Scenarios of docs/specs/public-directory.md for reporting a card and "Perdí
// mi enlace", on the built site with the seeded directory of Tizayuca:
// "Discreet "Reportar este negocio" control on the card", "Report mini-form
// without an account, with a closed-list reason and optional comment", "The
// server validates the report's reason and comment, and keeps the draft
// without a cookie (v2)", "The report form posts to its own address, which
// names the card (v2)", "The report submission confirms in plain Spanish
// and gives nothing away", "The report form lands on its thank-you page
// (v2)", "Report anti-abuse without captcha: honeypot, per-IP quota and
// pending cap per business", "The report's per-IP quota is counted in the
// quota counter (v2)", "No data is requested or stored about the reporter",
// "A report changes nothing public", ""Perdí mi enlace" button on the card,
// toward the admin's WhatsApp", ""Perdí mi enlace" opens WhatsApp to the
// admin of the card's locality (v2)" and "Directory in Server Components,
// mobile-first and usable without JavaScript". The controls and the form are
// rendered state by state in test/astro/report.test.ts, and the submission is
// tested with the database in test/worker/report.test.ts; the layout rules of
// the report pages (390px, metadata, brand) are checked by surfaces.spec.ts.
//
// Miniflare gives every request of this machine a loopback address, which the
// quota does not count. The test of the quota sends the address Cloudflare
// would write, one from the IPv6 range reserved for documentation, new on
// every run. Every report this file creates is removed, before and after.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { count, eq, inArray } from "drizzle-orm";
import { reports } from "../../src/core/db/schema/index.ts";
import { withDatabase } from "./database.ts";

const CARDS = "/hidalgo/tizayuca/negocio";
/** Seeded published cards this file reports, each for its own tests. */
const ELECTRICIAN = { id: "kamsdamstu", name: "Electricista Chispazo de Mentiras" };
const LOCKSMITH = { id: "65r9anw94p", name: "Cerrajería La Llave Inventada" };
const GROCER = { id: "697wvtkk7e", name: "Abarrotes La Esperanza Inventada" };
const VET = { id: "5dncvpyj8k", name: "Veterinaria Patitas Ficticias" };
const ACADEMY = { id: "s7hmtzvsk3", name: "Academia Halcones de Mentiras" };
const REPORTED = [ELECTRICIAN, LOCKSMITH, GROCER, VET, ACADEMY].map(({ id }) => id);

const ELECTRICIAN_CARD = `${CARDS}/electricista-chispazo-de-mentiras-kamsdamstu`;
const ELECTRICIAN_REPORT = `${ELECTRICIAN_CARD}/reportar`;
const reportOf = (card: { id: string; name: string }, segment: string) =>
  `${CARDS}/${segment}-${card.id}/reportar`;
const LOCKSMITH_REPORT = reportOf(LOCKSMITH, "cerrajeria-la-llave-inventada");
const GROCER_REPORT = reportOf(GROCER, "abarrotes-la-esperanza-inventada");
const VET_REPORT = reportOf(VET, "veterinaria-patitas-ficticias");
const THANKS = "/hidalgo/tizayuca/reportar/gracias";

const CONFIRMATION = "¡Gracias por avisarnos! Vamos a revisar este negocio.";
const LOST_LINK_MESSAGE =
  "Hola, soy de «Electricista Chispazo de Mentiras» en enmirumbo y perdí el enlace para " +
  "editar mi ficha. Les escribo desde el número que registré, ¿me lo pueden pasar?";

async function removeReports(): Promise<void> {
  await withDatabase(async (db) => {
    await db.delete(reports).where(inArray(reports.businessId, REPORTED));
  });
}

/** The reports of `businessId`, as the database keeps them. */
async function reportsOf(businessId: string) {
  let rows: (typeof reports.$inferSelect)[] = [];
  await withDatabase(async (db) => {
    rows = await db.select().from(reports).where(eq(reports.businessId, businessId));
  });
  return rows;
}

async function reportCount(businessId: string): Promise<number> {
  let n = 0;
  await withDatabase(async (db) => {
    const [row] = await db
      .select({ n: count() })
      .from(reports)
      .where(eq(reports.businessId, businessId));
    n = row?.n ?? 0;
  });
  return n;
}

/** Adds `n` unattended reports of `businessId` straight to the database. */
async function addPendingReports(businessId: string, n: number): Promise<void> {
  await withDatabase(async (db) => {
    await db.insert(reports).values(
      Array.from({ length: n }, () => ({
        businessId,
        localityCode: "13069",
        reason: "not_real" as const,
      })),
    );
  });
}

/** Posts a report form to `path` as a browser would, without following the answer. */
function post(request: APIRequestContext, path: string, form: Record<string, string>) {
  return request.post(`${path}?_action=report`, { form, maxRedirects: 0 });
}

/** Chooses a reason, writes a comment and sends the form of the page. */
async function sendReport(page: Page, reason: string | null, comment = "") {
  if (reason !== null) await page.getByRole("radio", { name: reason, exact: true }).check();
  if (comment !== "") await page.getByLabel("¿Nos quieres contar más? (opcional)").fill(comment);
  await page.getByRole("button", { name: "Enviar reporte" }).click();
}

test.beforeAll(removeReports);
test.afterAll(removeReports);

test.describe('Discreet "Reportar este negocio" control on the card', () => {
  // Scenarios: the card offers reporting without stealing WhatsApp's place;
  // reporting stays outside the contact block
  test("comes after the contact buttons, smaller than Enviar WhatsApp, and announces the business", async ({
    page,
  }) => {
    await page.goto(ELECTRICIAN_CARD);
    const main = page.getByRole("main");
    const whatsapp = main.getByRole("link", { name: /^Enviar WhatsApp/ });
    const report = main.getByRole("link", {
      name: `Reportar este negocio: ${ELECTRICIAN.name}`,
      exact: true,
    });

    await expect(report).toHaveText("Reportar este negocio");
    const [whatsappBox, reportBox] = [await whatsapp.boundingBox(), await report.boundingBox()];
    expect(reportBox!.y).toBeGreaterThan(whatsappBox!.y + whatsappBox!.height);
    expect(reportBox!.height).toBeGreaterThanOrEqual(44);
    expect(reportBox!.width * reportBox!.height).toBeLessThan(
      whatsappBox!.width * whatsappBox!.height,
    );
  });
});

test.describe('"Perdí mi enlace" button on the card, toward the admin\'s WhatsApp', () => {
  // Scenarios: asking for the link from the card; Tizayuca (v2)
  test("opens the contact WhatsApp of Tizayuca with the message written, in a new tab", async ({
    page,
  }) => {
    await page.goto(ELECTRICIAN_CARD);
    const main = page.getByRole("main");
    const lost = main.getByRole("link", { name: "Perdí mi enlace", exact: true });

    await expect(main.getByText("¿Es tu negocio?", { exact: true })).toBeVisible();
    const href = new URL((await lost.getAttribute("href")) ?? "");
    // The seed's made-up contact WhatsApp of Tizayuca (src/core/db/seed/index.ts).
    expect(`${href.origin}${href.pathname}`).toBe("https://wa.me/527719990100");
    expect(href.searchParams.get("text")).toBe(LOST_LINK_MESSAGE);
    await expect(lost).toHaveAttribute("target", "_blank");
    await expect(lost).toHaveAttribute("rel", "noopener noreferrer");
    // The last control of the card.
    await expect(main.getByRole("link").last()).toHaveText("Perdí mi enlace");
  });
});

test.describe("Report mini-form without an account, with a closed-list reason and optional comment", () => {
  // Scenario: complete report form
  test("the form of the card: its heading, the business, the reasons, the comment and nothing about the resident", async ({
    page,
  }) => {
    const response = await page.goto(ELECTRICIAN_REPORT);

    expect(response?.status()).toBe(200);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading")).toHaveText(["Reportar este negocio"]);
    await expect(main.getByText(ELECTRICIAN.name, { exact: true })).toBeVisible();
    await expect(
      main.getByText("Dinos qué pasa y lo revisamos. No te pedimos ningún dato tuyo."),
    ).toBeVisible();
    const reasons = main.getByRole("group", { name: "¿Qué pasa?" }).getByRole("radio");
    await expect(reasons).toHaveCount(4);
    for (const reason of [
      "Ya cerró",
      "No es real",
      "Los datos están mal",
      "Contenido ofensivo o inapropiado",
    ]) {
      await expect(main.getByRole("radio", { name: reason, exact: true })).not.toBeChecked();
    }
    await expect(main.getByLabel("¿Nos quieres contar más? (opcional)")).toHaveValue("");
    await expect(main.getByText("Máximo 300 caracteres.", { exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "Enviar reporte" })).toBeVisible();
    // Scenario: the form does not ask for reporter data
    await expect(main.getByRole("textbox")).toHaveCount(1);
    // Scenario: the report page is not indexed
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  // The report form posts to its own address, which names the card (v2),
  // scenario: an earlier name
  test("an address with an earlier name opens the same report form, and reports that card", async ({
    page,
    request,
  }) => {
    const earlier = `${CARDS}/academia-de-antes-${ACADEMY.id}/reportar`;
    await page.goto(earlier);

    await expect(page.getByRole("main").getByText(ACADEMY.name, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver a la ficha" })).toHaveAttribute(
      "href",
      `${CARDS}/academia-halcones-de-mentiras-${ACADEMY.id}`,
    );
    const response = await post(request, earlier, { reason: "incorrect_data" });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toBe(`${THANKS}?negocio=${ACADEMY.id}`);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await reportCount(ACADEMY.id)).toBe(1);
  });

  // Scenarios: reporting a business that is not published; submission with a
  // tampered identifier
  test("a card in review, rejected, of nowhere or without an identifier answers the same 404, also to a submission", async ({
    request,
  }) => {
    const notFound = await request.get(`${CARDS}/no-existe-zzzzzzzzzz`);
    expect(notFound.status()).toBe(404);
    const body = await notFound.text();
    for (const segment of [
      "barberia-el-corte-imaginario-c9yaseemtj",
      "taller-fantasma-de-mentiras-vj47rbgwgu",
      "no-existe-zzzzzzzzzz",
      "sin-identificador",
    ]) {
      for (const response of [
        await request.get(`${CARDS}/${segment}/reportar`),
        await post(request, `${CARDS}/${segment}/reportar`, { reason: "closed", comment: "x" }),
        await post(request, `${CARDS}/${segment}/reportar`, { website: "bot", reason: "closed" }),
      ]) {
        expect(response.status(), segment).toBe(404);
        expect(await response.text(), segment).toBe(body);
        expect(response.headers()["set-cookie"], segment).toBeUndefined();
      }
    }
    expect(body).not.toMatch(/Barbería|Taller Fantasma/);
    expect(await reportCount("c9yaseemtj")).toBe(0);
    expect(await reportCount("vj47rbgwgu")).toBe(0);
  });

  test("the action reached any other way saves nothing", async ({ request }) => {
    // From another page of the locality, and at the action's own endpoint.
    const home = await request.post("/hidalgo/tizayuca?_action=report", {
      form: { reason: "closed", comment: "desde otra página" },
    });
    expect(home.status()).toBe(404);
    const endpoint = await request.post("/_actions/report", {
      form: { reason: "closed", comment: "directo" },
    });
    expect(endpoint.status()).toBe(404);
    expect(endpoint.headers()["set-cookie"]).toBeUndefined();
    for (const id of REPORTED) {
      expect((await reportsOf(id)).map((report) => report.comment)).not.toContain("directo");
    }
  });
});

test.describe("Reporting without JavaScript, from the card to the thank-you page", () => {
  test.use({ javaScriptEnabled: false });

  // Scenarios: tapping the control opens the report form; the report works
  // without JavaScript; submission without choosing a reason; what the
  // resident wrote does not stay in the address (v2); report submitted;
  // reloading the confirmation does not duplicate
  test("an error comes back with what was written, then the report lands on its thank-you page", async ({
    page,
    context,
  }) => {
    await page.goto(ELECTRICIAN_CARD);
    await page.getByRole("link", { name: /^Reportar este negocio/ }).click();
    await expect(page).toHaveURL(ELECTRICIAN_REPORT);

    // Without a reason: the form again, from the same submission.
    const comment = "Ya no abre desde enero, el local está vacío";
    const [rejected] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"),
      sendReport(page, null, comment),
    ]);
    expect(rejected.status()).toBe(400);
    expect(rejected.headers()["set-cookie"]).toBeUndefined();
    expect(rejected.headers()["cache-control"]).toBe("no-store");
    await expect(page.getByRole("alert")).toHaveText(/Dinos qué pasa con este negocio/);
    await expect(page.getByLabel("¿Nos quieres contar más? (opcional)")).toHaveValue(comment);
    expect(page.url()).not.toContain("enero");
    expect(decodeURIComponent(page.url())).not.toContain(comment);
    expect(await reportCount(ELECTRICIAN.id)).toBe(0);

    // With a reason: the thank-you page.
    await sendReport(page, "Ya cerró");
    await expect(page).toHaveURL(`${THANKS}?negocio=${ELECTRICIAN.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONFIRMATION);
    const saved = await reportsOf(ELECTRICIAN.id);
    expect(saved.map(({ reason, comment: text, status }) => ({ reason, text, status }))).toEqual([
      { reason: "closed", text: comment, status: "pending" },
    ]);

    // Reloading the confirmation creates nothing.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONFIRMATION);
    expect(await reportCount(ELECTRICIAN.id)).toBe(1);

    // No cookie at any point.
    expect(await context.cookies()).toEqual([]);

    await page.getByRole("link", { name: "Volver a la ficha" }).click();
    await expect(page).toHaveURL(ELECTRICIAN_CARD);
  });

  // Scenario: comment too long (a forged submission: the field stops at 300)
  test("a comment past 300 characters comes back with its message; the field stops at 300", async ({
    page,
    request,
  }) => {
    await page.goto(VET_REPORT);
    await expect(page.getByLabel("¿Nos quieres contar más? (opcional)")).toHaveAttribute(
      "maxlength",
      "300",
    );

    const response = await post(request, VET_REPORT, {
      reason: "closed",
      comment: "a".repeat(301),
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("El comentario es muy largo (máximo 300 caracteres)");
    expect(await reportCount(VET.id)).toBe(0);
  });

  // Scenarios: reason outside the list; the submission does not choose where to return
  test("an invented reason and fields that point elsewhere change nothing", async ({ request }) => {
    const invented = await post(request, VET_REPORT, { reason: "otra", comment: "x" });
    expect(invented.status()).toBe(400);
    expect(await invented.text()).toContain("Dinos qué pasa con este negocio");

    const pointing = await post(request, VET_REPORT, {
      reason: "not_real",
      redirect: "https://evil.example",
      next: "//evil.example",
      path: "/\r\nSet-Cookie: x=1; Domain=evil.example",
    });
    expect(pointing.status()).toBe(303);
    expect(pointing.headers()["location"]).toBe(`${THANKS}?negocio=${VET.id}`);
    expect(pointing.headers()["set-cookie"]).toBeUndefined();
    expect(await reportCount(VET.id)).toBe(1);
  });

  // Scenario: the confirmation tells nothing about the business
  test("the thank-you page says the same however many reports the card had, and nothing else", async ({
    page,
  }) => {
    await page.goto(`${THANKS}?negocio=${VET.id}`);
    const main = page.getByRole("main");

    await expect(main.locator("section > *")).toHaveText([CONFIRMATION, "Volver a la ficha"]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test("the thank-you page of no reportable card is the 404", async ({ request }) => {
    const body = await (await request.get(`${CARDS}/no-existe-zzzzzzzzzz`)).text();
    for (const query of ["", "?negocio=zzzzzzzzzz", "?negocio=c9yaseemtj", "?negocio=%3Cb%3E"]) {
      const response = await request.get(`${THANKS}${query}`);
      expect(response.status(), query).toBe(404);
      expect(await response.text(), query).toBe(body);
    }
  });
});

test.describe("Report anti-abuse without captcha: honeypot, per-IP quota and pending cap per business", () => {
  // Scenario: bot that fills the honeypot
  test("a filled trap field lands on the same thank-you page and saves nothing", async ({
    request,
  }) => {
    const response = await post(request, LOCKSMITH_REPORT, {
      website: "https://spam.example",
      reason: "closed",
    });

    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toBe(`${THANKS}?negocio=${LOCKSMITH.id}`);
    expect(await reportCount(LOCKSMITH.id)).toBe(0);
  });

  // Scenario: whitespace only (v2)
  test("a trap field of only spaces is no trap: the report is saved", async ({ request }) => {
    const response = await post(request, LOCKSMITH_REPORT, { website: "   ", reason: "not_real" });

    expect(response.status()).toBe(303);
    expect(await reportCount(LOCKSMITH.id)).toBe(1);
  });

  // Scenario: business with the pending cap reached
  test("a card with 10 unattended reports takes no more, and the resident sees the usual confirmation", async ({
    browser,
  }) => {
    const before = await reportCount(GROCER.id);
    await addPendingReports(GROCER.id, 10 - before);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(GROCER_REPORT);
    await sendReport(page, "No es real", "Uno más");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONFIRMATION);
    expect(await reportCount(GROCER.id)).toBe(10);
    await context.close();
  });

  // Scenarios: per-IP quota exhausted; the report quota does not consume the
  // search one
  test("a fourth report from one address in the hour is not saved and says so", async ({
    browser,
  }) => {
    const hex = () => Math.floor(Math.random() * 0x10000).toString(16);
    const address = `2001:db8:${hex()}:${hex()}::1`;
    const context = await browser.newContext({
      javaScriptEnabled: false,
      extraHTTPHeaders: { "CF-Connecting-IP": address },
    });
    const page = await context.newPage();
    const before = await reportCount(VET.id);
    for (let n = 0; n < 3; n++) {
      await page.goto(VET_REPORT);
      await sendReport(page, "Los datos están mal", `Reporte ${n + 1}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONFIRMATION);
    }
    expect(await reportCount(VET.id)).toBe(before + 3);

    await page.goto(VET_REPORT);
    const [over] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"),
      sendReport(page, "Los datos están mal", "El cuarto"),
    ]);
    expect(over.status()).toBe(429);
    await expect(page.getByRole("alert")).toHaveText(
      /Ya recibimos varios reportes desde aquí\. Espera un rato y vuelve a intentar\./,
    );
    await expect(page.getByLabel("¿Nos quieres contar más? (opcional)")).toHaveValue("El cuarto");
    await expect(page.getByRole("radio", { name: "Los datos están mal" })).toBeChecked();
    expect(await reportCount(VET.id)).toBe(before + 3);

    // The search of the same address is not held back.
    const search = await page.goto("/hidalgo/tizayuca/buscar?q=veterinaria");
    expect(search?.status()).toBe(200);
    await context.close();
  });
});

test.describe("No data is requested or stored about the reporter, and a report changes nothing public", () => {
  test.use({ javaScriptEnabled: false });

  // Scenarios: the reported card stays the same; no trace of reports in the
  // public HTML; nothing about the reporter is stored
  test("after a report the card, its listing and the search read the same, and the report holds nothing of its sender", async ({
    browser,
    request,
  }) => {
    const pages = [
      `${CARDS}/cerrajeria-la-llave-inventada-65r9anw94p`,
      "/hidalgo/tizayuca/servicios-del-hogar",
      "/hidalgo/tizayuca/buscar?q=cerrajeria",
    ];
    const main = async (path: string) =>
      /<main\b[\s\S]*<\/main>/.exec(await (await request.get(path)).text())?.[0] ?? "";
    const before = await Promise.all(pages.map(main));

    const address = "2001:db8:37:37::37";
    const context = await browser.newContext({
      javaScriptEnabled: false,
      extraHTTPHeaders: { "CF-Connecting-IP": address },
    });
    const page = await context.newPage();
    const comment = "Comentario único de la prueba de privacidad";
    await page.goto(LOCKSMITH_REPORT);
    await sendReport(page, "Contenido ofensivo o inapropiado", comment);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONFIRMATION);
    await context.close();

    const after = await Promise.all(pages.map(main));
    expect(after).toEqual(before);
    for (const html of after) {
      expect(html).not.toContain(comment);
      expect(html).not.toContain("Contenido ofensivo");
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toMatch(/reportar|gracias/);

    const saved = (await reportsOf(LOCKSMITH.id)).find((report) => report.comment === comment);
    expect(saved).toBeDefined();
    expect(JSON.stringify(saved)).not.toContain(address);
    expect(JSON.stringify(saved)).not.toContain("2001:db8");
  });
});
