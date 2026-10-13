// Authorization for admin Astro Actions (ADR 0010). Actions are public
// endpoints (`/_actions/<name>`, or `?_action=<name>` on any page), so every
// admin action handler starts with `const admin = await requireAdmin(context)`.
// It verifies the request's own Access token instead of trusting
// `context.locals`, and throws before the handler reads or writes anything.
import { ActionError } from "astro:actions";
import { env } from "cloudflare:workers";
import type { AdminGateDeps } from "./admin-gate.ts";
import {
  authorizeAdminRequest,
  logDenial,
  readAccessConfig,
  remoteAccessKeys,
  type AdminIdentity,
} from "./verify.ts";

export async function requireAdmin(
  context: { request: Request },
  deps: AdminGateDeps = { config: readAccessConfig(env), keys: remoteAccessKeys },
): Promise<AdminIdentity> {
  const decision = await authorizeAdminRequest(context.request, deps.config, deps.keys);
  if (!decision.allowed) {
    logDenial(decision.denial);
    throw new ActionError({ code: "FORBIDDEN", message: "No tienes acceso." });
  }
  return decision.identity;
}
