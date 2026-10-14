// Scenarios of docs/specs/public-directory.md, requirements:
// - "Public URLs carry the state and the municipality (v2)"
// - "Unknown or inactive state and municipality answer 404 (v2)"
// - "While there is one active locality, the root and the alias redirect to it (v2)"
// - "With two or more active localities the root lists them and never redirects by location (v2)"
// the pieces behind them: the active localities (src/core/locality/served.ts),
// the root and the alias (src/core/locality/root.ts), the paths
// (src/core/locality/paths.ts) and the middleware's gate (src/lib/locality.ts).
// The pages themselves are covered by test/e2e/locality-routes.spec.ts. Other
// test files add active fixture localities while this one runs, so the
// database checks look only at this file's state.
import { env, waitUntil } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { withDb } from "../../src/core/db/client.ts";
import { localities, municipalities, states } from "../../src/core/db/schema/index.ts";
import { isReservedSegment } from "../../src/core/catalogue/root-urls.ts";
import { localityPath } from "../../src/core/locality/paths.ts";
import { aliasDestination, rootDestination } from "../../src/core/locality/root.ts";
import {
  activeLocalities,
  servedLocality,
  type ServedLocality,
} from "../../src/core/locality/served.ts";
import {
  gateLocalityRequest,
  isLocalityRoute,
  permanentRedirect,
  requireLocality,
  type FindLocality,
  type LocalityGateContext,
} from "../../src/lib/locality.ts";
import { cleanup, createFixture, db, type Fixture } from "./fixtures.ts";

const STATE = "94";
const STATE_SLUG = `estado-de-prueba-${STATE}`;
let f: Fixture;

beforeAll(async () => {
  f = await createFixture(STATE);
});

afterAll(async () => {
  await cleanup(STATE);
});

/** A locality as servedLocality returns it, made up for the pure checks. */
function locality(stateSlug: string, slug: string): ServedLocality {
  return {
    code: "00000",
    name: slug,
    slug,
    state: { code: "00", name: stateSlug, slug: stateSlug },
    timeZone: "America/Mexico_City",
    contactWhatsapp: "7719990001",
  };
}

const HIDALGO_TIZAYUCA = locality("hidalgo", "tizayuca");
const OTHER = locality("jalisco", "pueblo-uno");

const setActive = (code: string, active: boolean) =>
  db((tx) => tx.update(localities).set({ active }).where(eq(localities.code, code)));

/** The active localities of this file's fixture state. */
async function activeHere(): Promise<string[]> {
  const all = await withDb(env, "HYPERDRIVE_FRESH", { waitUntil }, activeLocalities);
  return all.filter((l) => l.state.code === STATE).map((l) => l.slug);
}

describe("Public URLs carry the state and the municipality (v2)", () => {
  it("the home of a locality is /{estado}/{municipio}, read from its record", () => {
    expect(localityPath(HIDALGO_TIZAYUCA)).toBe("/hidalgo/tizayuca");
  });

  it("every page of a locality hangs from its prefix", () => {
    expect(localityPath(HIDALGO_TIZAYUCA, "plomeria-haciendas-de-tizayuca")).toBe(
      "/hidalgo/tizayuca/plomeria-haciendas-de-tizayuca",
    );
    expect(localityPath(HIDALGO_TIZAYUCA, "negocio", "plomeria-de-prueba-a1b2c3d4")).toBe(
      "/hidalgo/tizayuca/negocio/plomeria-de-prueba-a1b2c3d4",
    );
  });

  it("a segment cannot add a level or leave the path", () => {
    expect(localityPath(HIDALGO_TIZAYUCA, "a/b", "?x=1")).toBe("/hidalgo/tizayuca/a%2Fb/%3Fx%3D1");
  });

  it("the middleware resolves the locality of every page under the prefix, and only there", () => {
    for (const route of [
      "/[state]/[municipality]",
      "/[state]/[municipality]/[segment]",
      "/[state]/[municipality]/negocio/[card]",
    ]) {
      expect(isLocalityRoute(route), route).toBe(true);
    }
    for (const route of [
      "/",
      "/[alias]",
      "/admin",
      "/admin/[...path]",
      "/health",
      "/robots.txt",
      "/404",
      "/_actions/[...path]",
      "/[state]",
      "/[state]/[municipalityx]",
    ]) {
      expect(isLocalityRoute(route), route).toBe(false);
    }
  });

  it("no state or municipality slug of the catalogue is one of the site's own segments", async () => {
    const slugs = await db(async (tx) => [
      ...(await tx.select({ slug: states.slug }).from(states)),
      ...(await tx.select({ slug: municipalities.slug }).from(municipalities)),
    ]);
    expect(slugs.length).toBeGreaterThan(2478);
    expect(slugs.filter(({ slug }) => isReservedSegment(slug))).toEqual([]);
  });
});

describe("Unknown or inactive state and municipality answer 404 (v2)", () => {
  /** Runs the gate on a route and reports what it did. */
  async function gate(
    routePattern: string,
    params: Record<string, string | undefined>,
    find: FindLocality,
  ) {
    const context: LocalityGateContext = { routePattern, params, locals: {} };
    const next = vi.fn(async () => new Response("page"));
    const response = await gateLocalityRequest(context, next, find);
    return { response, next, locals: context.locals };
  }

  const fromDatabase: FindLocality = (stateSlug, municipalitySlug) =>
    withDb(env, "HYPERDRIVE_FRESH", { waitUntil }, (tx) =>
      servedLocality(tx, stateSlug, municipalitySlug),
    );

  it("an active locality reaches its page with the locality in locals", async () => {
    const { response, next, locals } = await gate(
      "/[state]/[municipality]",
      { state: STATE_SLUG, municipality: "pueblo-uno" },
      fromDatabase,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(await response.text()).toBe("page");
    expect(locals.locality).toMatchObject({ code: f.localityA, name: "Pueblo Uno" });
    expect(requireLocality(locals)).toBe(locals.locality);
  });

  it.for([
    ["a state that does not exist", "atlantida", "pueblo-uno"],
    ["a real municipality that is not active", STATE_SLUG, "pueblo-dos"],
    ["a municipality of the catalogue without a locality", "hidalgo", "pachuca-de-soto"],
    ["a municipality under the wrong state", "jalisco", "pueblo-uno"],
    ["a segment that cannot be a slug", STATE_SLUG.toUpperCase(), "pueblo-uno"],
  ] as const)(
    "%s answers an empty 404 and the page never runs",
    async ([, state, municipality]) => {
      const { response, next, locals } = await gate(
        "/[state]/[municipality]/[segment]",
        { state, municipality, segment: "plomeria" },
        fromDatabase,
      );
      expect(response.status).toBe(404);
      // An empty body is what makes Astro render the site's 404 page.
      expect(response.body).toBeNull();
      expect(next).not.toHaveBeenCalled();
      expect(locals.locality).toBeUndefined();
    },
  );

  it("missing parameters answer 404 without asking the database", async () => {
    const find = vi.fn<FindLocality>();
    const { response } = await gate("/[state]/[municipality]", { state: "hidalgo" }, find);
    expect(response.status).toBe(404);
    expect(find).not.toHaveBeenCalled();
  });

  it("other routes pass through without a lookup", async () => {
    const find = vi.fn<FindLocality>();
    for (const route of ["/", "/[alias]", "/admin", "/health", "/robots.txt", "/404"]) {
      const { response, next } = await gate(route, { alias: "tizayuca" }, find);
      expect(next, route).toHaveBeenCalledOnce();
      expect(response.status, route).toBe(200);
    }
    expect(find).not.toHaveBeenCalled();
  });

  it("a page outside a locality cannot ask for one", () => {
    expect(() => requireLocality({})).toThrow(/not under/);
  });

  it("activating a locality serves it, deactivating it answers 404 again", async () => {
    const route = "/[state]/[municipality]";
    const params = { state: STATE_SLUG, municipality: "pueblo-dos" };
    await setActive(f.localityB, true);
    try {
      expect((await gate(route, params, fromDatabase)).locals.locality?.code).toBe(f.localityB);
    } finally {
      await setActive(f.localityB, false);
    }
    expect((await gate(route, params, fromDatabase)).response.status).toBe(404);
  });
});

describe("While there is one active locality, the root and the alias redirect to it (v2)", () => {
  it("the active localities are read from the database, inactive ones left out", async () => {
    expect(await activeHere()).toEqual(["pueblo-uno"]);
    await setActive(f.localityB, true);
    try {
      expect(await activeHere()).toEqual(["pueblo-dos", "pueblo-uno"]);
    } finally {
      await setActive(f.localityB, false);
    }
  });

  it("the root: one active locality is a redirect to its home", () => {
    expect(rootDestination([HIDALGO_TIZAYUCA])).toEqual({
      kind: "locality",
      locality: HIDALGO_TIZAYUCA,
    });
    expect(localityPath(HIDALGO_TIZAYUCA)).toBe("/hidalgo/tizayuca");
  });

  it("the alias: the municipality slug of the only active locality", () => {
    expect(aliasDestination([HIDALGO_TIZAYUCA], "tizayuca")).toBe(HIDALGO_TIZAYUCA);
  });

  it("any other single segment is no alias", () => {
    for (const segment of ["hidalgo", "plomeria-haciendas-de-tizayuca", "Tizayuca", "", "a/b"]) {
      expect(aliasDestination([HIDALGO_TIZAYUCA], segment), segment).toBeNull();
    }
  });

  it("read from the record: another locality, its own path and alias", async () => {
    const here = (await withDb(env, "HYPERDRIVE_FRESH", { waitUntil }, activeLocalities)).filter(
      (l) => l.state.code === STATE,
    );
    expect(here).toHaveLength(1);
    expect(rootDestination(here)).toEqual({ kind: "locality", locality: here[0] });
    expect(localityPath(here[0]!)).toBe(`/${STATE_SLUG}/pueblo-uno`);
    expect(aliasDestination(here, "pueblo-uno")).toBe(here[0]);
    expect(aliasDestination(here, "tizayuca")).toBeNull();
  });

  it("with no active locality there is nothing to redirect to", () => {
    expect(rootDestination([])).toEqual({ kind: "none" });
    expect(aliasDestination([], "tizayuca")).toBeNull();
  });

  it("the redirect is a 301 that browsers keep for an hour at most", async () => {
    const response = permanentRedirect("/hidalgo/tizayuca");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/hidalgo/tizayuca");
    expect(response.headers.get("Cache-Control")).toBe("max-age=3600");
    expect(await response.text()).toBe("");
  });
});

describe("With two or more active localities the root lists them and never redirects by location (v2)", () => {
  it("the root does not redirect: it gets the list, in order, for EMR-29 to show", () => {
    expect(rootDestination([HIDALGO_TIZAYUCA, OTHER])).toEqual({
      kind: "list",
      localities: [HIDALGO_TIZAYUCA, OTHER],
    });
  });

  it("no alias redirects while the specification covers only a single locality", () => {
    expect(aliasDestination([HIDALGO_TIZAYUCA, OTHER], "tizayuca")).toBeNull();
  });
});
