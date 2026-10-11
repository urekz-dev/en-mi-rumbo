import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { expect, it, vi } from "vite-plus/test";
import { runScheduledTasks } from "../../src/scheduled.ts";

it("runs the scheduled handler inside workerd with the Worker bindings", async () => {
  expect(navigator.userAgent).toBe("Cloudflare-Workers");
  expect(typeof env.ASSETS.fetch).toBe("function");

  const log = vi.spyOn(console, "log");
  const controller = createScheduledController({
    cron: "0 * * * *",
    scheduledTime: new Date("2026-10-11T14:00:00Z"),
  });
  const ctx = createExecutionContext();

  await runScheduledTasks(controller, env, ctx);
  await waitOnExecutionContext(ctx);

  expect(log).toHaveBeenCalledWith('scheduled: cron "0 * * * *" at 2026-10-11T14:00:00.000Z');
});
