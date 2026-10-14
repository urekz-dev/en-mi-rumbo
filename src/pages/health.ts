// /health: whether the Worker reaches the database (src/lib/health.ts).
import type { APIRoute } from "astro";
import { env, waitUntil } from "cloudflare:workers";
import { healthResponse } from "../lib/health.ts";

export const GET: APIRoute = () => healthResponse(env, { waitUntil });
