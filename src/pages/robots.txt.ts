// /robots.txt: closed on every deployed environment until the cut-over, without
// reading the database; open where indexing is allowed, with the exclusions of
// every active locality, read through the cached HYPERDRIVE, and the sitemap
// (src/lib/robots.ts, ADR 0008).
import type { APIRoute } from "astro";
import { env, waitUntil } from "cloudflare:workers";
import { withDb } from "../core/db/client.ts";
import { activeLocalities } from "../core/locality/served.ts";
import { blocksIndexing, CLOSED_ROBOTS_TXT, openRobotsTxt, SITEMAP_PATH } from "../lib/robots.ts";
import { absoluteUrl } from "../lib/site-url.ts";

export const GET: APIRoute = async () => {
  const body = blocksIndexing(env.ENVIRONMENT)
    ? CLOSED_ROBOTS_TXT
    : openRobotsTxt(
        await withDb(env, "HYPERDRIVE", { waitUntil }, (db) => activeLocalities(db)),
        absoluteUrl(env, SITEMAP_PATH),
      );
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
