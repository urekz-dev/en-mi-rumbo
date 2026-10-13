// The /admin gate that src/middleware.ts runs on every request (ADR 0010). It
// decides which requests belong to the panel, refuses them with a generic 403
// unless authorizeAdminRequest allows them, and marks every panel response as
// not indexable and not cacheable.
import {
  authorizeAdminRequest,
  logDenial,
  type AccessConfig,
  type AccessKeys,
  type AdminIdentity,
} from "./verify.ts";

export const ADMIN_HEADERS: Readonly<Record<string, string>> = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

// The same body for every refusal: it names no resource and says nothing about
// why, so it cannot confirm that a card or an identifier exists.
const FORBIDDEN_BODY = `<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Sin acceso · enmirumbo</title>
  </head>
  <body>
    <main>
      <h1>No tienes acceso a esta página</h1>
      <p>Si crees que es un error, avísale al equipo de enmirumbo.</p>
    </main>
  </body>
</html>
`;

export function forbiddenResponse(): Response {
  return new Response(FORBIDDEN_BODY, {
    status: 403,
    headers: { ...ADMIN_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}

export function withAdminHeaders(response: Response): Response {
  try {
    for (const [name, value] of Object.entries(ADMIN_HEADERS)) response.headers.set(name, value);
    return response;
  } catch {
    // The headers of some responses are immutable; copy it instead.
    const copy = new Response(response.body, response);
    for (const [name, value] of Object.entries(ADMIN_HEADERS)) copy.headers.set(name, value);
    return copy;
  }
}

/**
 * Whether a request belongs to the admin panel: anything at `/admin` or below,
 * whatever its case or URL encoding, any request Astro routed to an admin
 * page, and the Astro Actions under the `admin` namespace (`/_actions/admin.*`
 * and `?_action=admin.*`). An admin action must still call requireAdmin
 * itself: this check is the second line, not the only one.
 */
export function isAdminRequest(url: URL, routePattern: string): boolean {
  if (isAdminPath(routePattern)) return true;
  const path = normalizePath(url.pathname);
  if (path === undefined) return true; // Undecodable: fail closed.
  if (isAdminPath(path) || path.startsWith("/_actions/admin.")) return true;
  const action = url.searchParams.get("_action");
  if (action === null) return false;
  const name = normalizePath(action);
  return name === undefined || name.startsWith("admin.");
}

export interface AdminGateContext {
  request: Request;
  url: URL;
  routePattern: string;
  locals: { admin?: AdminIdentity };
}

export interface AdminGateDeps {
  config: AccessConfig;
  keys: AccessKeys;
}

export async function gateAdminRequest(
  context: AdminGateContext,
  next: () => Promise<Response>,
  deps: AdminGateDeps,
): Promise<Response> {
  if (!isAdminRequest(context.url, context.routePattern)) return next();

  const decision = await authorizeAdminRequest(context.request, deps.config, deps.keys);
  if (!decision.allowed) {
    logDenial(decision.denial);
    return forbiddenResponse();
  }
  context.locals.admin = decision.identity;
  return withAdminHeaders(await next());
}

function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

// Decodes until stable (Astro also decodes repeatedly before routing),
// lowercases, turns backslashes into slashes and collapses repeated slashes.
// Returns undefined when the encoding is broken.
function normalizePath(path: string): string | undefined {
  let current = path;
  for (let round = 0; round < 10; round++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return undefined;
    }
    if (decoded === current) {
      return current
        .toLowerCase()
        .replaceAll("\\", "/")
        .replace(/\/{2,}/g, "/");
    }
    current = decoded;
  }
  return undefined;
}
