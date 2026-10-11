// The hourly jobs (ADR 0013). For now the handler only logs that it ran.
export async function runScheduledTasks(
  controller: ScheduledController,
  _env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  console.log(
    `scheduled: cron "${controller.cron}" at ${new Date(controller.scheduledTime).toISOString()}`,
  );
}
