// Worker entry: Astro serves every request, and the scheduled handler runs
// the hourly jobs (ADR 0013). Every response of a deployed environment asks
// not to be indexed (src/lib/robots.ts, ADR 0008).
import { handle } from "@astrojs/cloudflare/handler";
import { withRobotsPolicy } from "./lib/robots.ts";
import { runScheduledTasks } from "./scheduled.ts";

export default {
  fetch: async (request, env, ctx) =>
    withRobotsPolicy(await handle(request, env, ctx), env.ENVIRONMENT),
  scheduled: (controller, env, ctx) => runScheduledTasks(controller, env, ctx),
} satisfies ExportedHandler<Env>;
