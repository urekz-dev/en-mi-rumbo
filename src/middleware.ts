// Astro middleware: every request to /admin and below, and every admin action,
// passes the Cloudflare Access check first (ADR 0010, src/lib/access/).
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { gateAdminRequest } from "./lib/access/admin-gate.ts";
import { readAccessConfig, remoteAccessKeys } from "./lib/access/verify.ts";

export const onRequest = defineMiddleware((context, next) =>
  gateAdminRequest(context, next, { config: readAccessConfig(env), keys: remoteAccessKeys }),
);
