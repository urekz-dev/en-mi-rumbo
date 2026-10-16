// Worker entry: Astro serves every request, and the scheduled handler runs
// the hourly jobs (ADR 0013). Every response carries the security headers
// (src/lib/security-headers.ts) and, in a deployed environment, asks not to be
// indexed (src/lib/robots.ts, ADR 0008). The static assets never reach this
// Worker: the build gives them the same headers through `_headers`
// (src/integrations/static-headers.ts).
import { handle } from "@astrojs/cloudflare/handler";
import { withRobotsPolicy } from "./lib/robots.ts";
import { withSecurityHeaders } from "./lib/security-headers.ts";
import { runScheduledTasks } from "./scheduled.ts";

/** Astro's answer, or a bare 500 when the handler itself throws, so it carries the headers too. */
async function astro(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    return await handle(request, env, ctx);
  } catch (error) {
    console.error("worker: the request failed", error);
    return new Response(null, { status: 500 });
  }
}

export default {
  fetch: async (request, env, ctx) =>
    withSecurityHeaders(
      withRobotsPolicy(await astro(request, env, ctx), env.ENVIRONMENT),
      request,
      env,
      // The dev server's pages need Vite's inline styles and scripts, which
      // the policy forbids; every build, the preview included, sends it.
      { csp: !import.meta.env.DEV },
    ),
  scheduled: (controller, env, ctx) => runScheduledTasks(controller, env, ctx),
} satisfies ExportedHandler<Env>;
