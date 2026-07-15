import type { ActionAdapter } from "../action-registry.js";
import type { AlertPort } from "./task.actions.js";

export interface JobActionPort {
  retry(jobId: string, idempotencyKey: string): Promise<{ jobId: string }>;
}

function strict(config: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(config).find(key => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown config key: ${unknown}`);
  for (const key of allowed) if (config[key] === undefined || config[key] === "") throw new Error(`Missing ${key}`);
}

export function createOperationsActions({ jobs, alerts }: { jobs: JobActionPort; alerts: AlertPort }): ActionAdapter[] {
  const retry: ActionAdapter = {
    type: "job.retry",
    sensitive: false,
    validate(config) {
      strict(config, ["jobId"]);
      if (typeof config.jobId !== "string" || !/^[a-fA-F0-9]{24}$/.test(config.jobId)) throw new Error("Invalid job ID");
    },
    async preview(config) {
      this.validate(config);
      return { jobId: config.jobId, operation: "retry once" };
    },
    async execute(config, context) {
      this.validate(config);
      return jobs.retry(String(config.jobId), context.idempotencyKey);
    },
    async compensate(_config, result, context) {
      const alert = await alerts.create({ type: "automation.retry_manual_verification", priority: "high", jobId: result.jobId, message: "A retried job cannot be recalled; verify its outcome manually" }, context.idempotencyKey);
      return { alertId: alert.alertId };
    },
  };
  const alert: ActionAdapter = {
    type: "operations.alert",
    sensitive: false,
    validate(config) {
      strict(config, ["message", "priority"]);
      if (typeof config.message !== "string" || config.message.trim().length === 0 || config.message.length > 10_000) throw new Error("Invalid alert message");
      if (!["low", "medium", "high"].includes(String(config.priority))) throw new Error("Invalid priority");
    },
    async preview(config) {
      this.validate(config);
      return { message: config.message, priority: config.priority };
    },
    async execute(config, context) {
      this.validate(config);
      return alerts.create(config, context.idempotencyKey);
    },
    async compensate(_config, result, context) {
      if (typeof result.alertId !== "string" || result.alertId.length === 0) throw new Error("Invalid alert ID");
      await alerts.resolve(result.alertId, "Resolved because of automation rollback", context.idempotencyKey);
      return { resolved: true };
    },
  };
  return [retry, alert];
}
