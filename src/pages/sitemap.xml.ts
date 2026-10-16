// /sitemap.xml, generated from the database on every request through the
// cached HYPERDRIVE (src/core/seo/sitemap.ts), with absolute URLs from
// SITE_URL. In a deployed environment without a usable SITE_URL it is an
// empty sitemap, never a local address. Until the cut-over it carries
// `X-Robots-Tag: noindex` there, like every response (src/lib/robots.ts),
// and the closed robots.txt does not announce it.
import type { APIRoute } from "astro";
import { env, waitUntil } from "cloudflare:workers";
import { withDb } from "../core/db/client.ts";
import { sitemapEntries, sitemapXml } from "../core/seo/sitemap.ts";
import { siteOrigin } from "../lib/site-url.ts";

export const GET: APIRoute = async () => {
  const origin = siteOrigin(env);
  const entries =
    origin === null ? [] : await withDb(env, "HYPERDRIVE", { waitUntil }, sitemapEntries);
  return new Response(sitemapXml(origin, entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
