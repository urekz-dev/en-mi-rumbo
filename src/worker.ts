// Worker entry: Astro serves every request, and the scheduled handler runs
// the hourly jobs (ADR 0013).
import { handle } from "@astrojs/cloudflare/handler";
import { runScheduledTasks } from "./scheduled.ts";

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
  scheduled: (controller, env, ctx) => runScheduledTasks(controller, env, ctx),
} satisfies ExportedHandler<Env>;
