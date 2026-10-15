// docs/specs/base-layout.md, "Deployed environments stay out of search engines
// until the cut-over (v2)", scenario "a prerendered page of a deployed
// environment": Cloudflare serves the static assets without the Worker, so a
// deployed build gives them the header through `_headers`
// (src/integrations/static-noindex.ts). The deploy refuses a build without it
// (test/scripts/deploy-scripts.test.ts), and the smoke test checks a legal page
// after each deploy.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  addStaticNoindex,
  builtEnvironment,
  STATIC_NOINDEX_RULE,
} from "../../src/integrations/static-noindex.ts";

/** What the Cloudflare adapter writes before: the cache rule of /_astro/. */
const ADAPTER_RULES = "/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n";

let build: string;
let server: URL;
let client: URL;

beforeEach(() => {
  build = mkdtempSync(join(tmpdir(), "enmirumbo-build-"));
  mkdirSync(join(build, "server"));
  mkdirSync(join(build, "client"));
  server = pathToFileURL(join(build, "server/"));
  client = pathToFileURL(join(build, "client/"));
});

afterEach(() => {
  rmSync(build, { recursive: true, force: true });
});

function writeConfig(config: unknown): void {
  writeFileSync(join(build, "server/wrangler.json"), JSON.stringify(config));
}

const headers = () => readFileSync(join(build, "client/_headers"), "utf8");

describe("Deployed environments stay out of search engines until the cut-over (v2): static assets", () => {
  it("the rule gives every static asset X-Robots-Tag: noindex", () => {
    expect(STATIC_NOINDEX_RULE).toBe("/*\n  X-Robots-Tag: noindex\n");
  });

  it.for(["dev", "stage", "prod"])(
    "a build for %s adds the rule after the adapter's, keeping them",
    async (environment) => {
      writeConfig({ vars: { ENVIRONMENT: environment } });
      writeFileSync(join(build, "client/_headers"), ADAPTER_RULES);

      expect(await builtEnvironment(server)).toBe(environment);
      expect(await addStaticNoindex(client, environment)).toBe(true);
      expect(headers().startsWith(ADAPTER_RULES)).toBe(true);
      expect(headers().endsWith(STATIC_NOINDEX_RULE)).toBe(true);
    },
  );

  it("adding it twice leaves a single rule", async () => {
    await addStaticNoindex(client, "prod");
    await addStaticNoindex(client, "prod");

    expect(headers().split(STATIC_NOINDEX_RULE)).toHaveLength(2);
  });

  // Scenario: local
  it("a local build adds nothing: the static pages stay indexable", async () => {
    writeConfig({ vars: { ENVIRONMENT: "local" } });
    writeFileSync(join(build, "client/_headers"), ADAPTER_RULES);

    expect(await addStaticNoindex(client, await builtEnvironment(server))).toBe(false);
    expect(headers()).toBe(ADAPTER_RULES);
  });

  // Scenario: an unknown environment
  it.for([
    ["no configuration", undefined],
    ["no ENVIRONMENT", { vars: {} }],
    ["an unknown ENVIRONMENT", { vars: { ENVIRONMENT: "production" } }],
  ] as const)("%s counts as deployed", async ([, config]) => {
    if (config !== undefined) writeConfig(config);

    expect(await addStaticNoindex(client, await builtEnvironment(server))).toBe(true);
    expect(headers()).toContain(STATIC_NOINDEX_RULE);
  });
});
