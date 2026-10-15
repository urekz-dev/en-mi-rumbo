// Prerendered pages stay out of search engines too (docs/specs/base-layout.md,
// "Deployed environments stay out of search engines until the cut-over (v2)").
//
// Cloudflare serves the static assets of the build (the prerendered legal
// pages and the hashed CSS under /_astro/) without invoking the Worker, so the
// `X-Robots-Tag: noindex` that src/worker.ts adds never reaches them. For
// those files Cloudflare applies the rules of the `_headers` file at the root
// of the assets instead, and only to them, never to a Worker response. After
// each build this integration reads the environment the build targets (the
// ENVIRONMENT of dist/server/wrangler.json, the file `wrangler deploy`
// deploys) and, when that environment blocks indexing (`blocksIndexing`, the
// same rule the Worker follows), adds a rule that gives every static asset
// the header. A local build gets none, and when the cut-over lets production
// be indexed, its builds stop getting it with no other change.
// scripts/deploy/check-build.sh refuses a deployed build without the rule.
import { readFile, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { blocksIndexing, NOINDEX, ROBOTS_HEADER } from "../lib/robots.ts";

/** The `_headers` rule that asks search engines not to index any static asset. */
export const STATIC_NOINDEX_RULE = `/*\n  ${ROBOTS_HEADER}: ${NOINDEX}\n`;

const COMMENT =
  "# Deployed environments stay out of search engines until the cut-over (ADR 0008).\n";

/** The ENVIRONMENT var of the Worker configuration a build wrote, if any. */
export async function builtEnvironment(serverDir: URL): Promise<string | undefined> {
  let config: unknown;
  try {
    config = JSON.parse(await readFile(new URL("./wrangler.json", serverDir), "utf8"));
  } catch {
    // No configuration to read: the environment is unknown, which counts as
    // deployed (blocksIndexing fails closed).
    return undefined;
  }
  const vars = (config as { vars?: Record<string, unknown> } | null)?.vars;
  const environment = vars?.["ENVIRONMENT"];
  return typeof environment === "string" ? environment : undefined;
}

/**
 * Adds the noindex rule to the `_headers` file of the static assets when the
 * environment blocks indexing, keeping the rules already there (the adapter
 * writes the cache rule of /_astro/). Returns whether the file carries it.
 */
export async function addStaticNoindex(
  clientDir: URL,
  environment: string | undefined,
): Promise<boolean> {
  if (!blocksIndexing(environment)) return false;
  const file = new URL("./_headers", clientDir);
  let headers = "";
  try {
    headers = await readFile(file, "utf8");
  } catch {
    // No _headers yet: this rule is the first.
  }
  if (headers.includes(STATIC_NOINDEX_RULE)) return true;
  const before = headers === "" ? "" : `${headers.trimEnd()}\n\n`;
  await writeFile(file, `${before}${COMMENT}${STATIC_NOINDEX_RULE}`);
  return true;
}

export function staticNoindex(): AstroIntegration {
  let serverDir: URL | undefined;
  let clientDir: URL | undefined;
  return {
    name: "enmirumbo:static-noindex",
    hooks: {
      "astro:config:done": ({ config }) => {
        serverDir = config.build.server;
        clientDir = config.build.client;
      },
      "astro:build:done": async ({ logger }) => {
        if (serverDir === undefined || clientDir === undefined) return;
        const environment = await builtEnvironment(serverDir);
        const added = await addStaticNoindex(clientDir, environment);
        logger.info(
          added
            ? `${ROBOTS_HEADER}: ${NOINDEX} for every static asset of ${environment ?? "an unknown environment"}`
            : `static assets stay indexable in ${environment ?? "an unknown environment"}`,
        );
      },
    },
  };
}
