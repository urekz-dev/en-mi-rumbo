// Worker entry for the workers test project. src/worker.ts imports Astro's
// handler, which only resolves inside an Astro build, so tests load this
// entry with the same bindings instead.
import { runScheduledTasks } from "../../src/scheduled.ts";

export default {
  scheduled: (controller, env, ctx) => runScheduledTasks(controller, env, ctx),
} satisfies ExportedHandler<Env>;
