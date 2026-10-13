// /robots.txt: closed on every deployed environment until the cut-over
// (src/lib/robots.ts, ADR 0008).
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { robotsTxt } from "../lib/robots.ts";

export const GET: APIRoute = () =>
  new Response(robotsTxt(env.ENVIRONMENT), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
