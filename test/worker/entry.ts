// Worker entry for the workers test project. src/worker.ts imports Astro's
// handler, which only resolves inside an Astro build, so tests load this
// entry with the same bindings instead, and the same Durable Objects.
import { runScheduledTasks } from "../../src/scheduled.ts";

export { QuotaCounter } from "../../src/lib/quota/counter.ts";

export default {
  scheduled: (controller, env, ctx) => runScheduledTasks(controller, env, ctx),
} satisfies ExportedHandler<Env>;
