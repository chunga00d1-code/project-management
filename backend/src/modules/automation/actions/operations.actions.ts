import type { ActionAdapter } from "../action-registry.js";
import type { AlertPort } from "./task.actions.js";
export interface JobActionPort { retry(jobId: string, idempotencyKey: string): Promise<{ jobId: string }> }
function strict(c: Record<string, unknown>, allowed: string[]) { const u = Object.keys(c).find(k => !allowed.includes(k)); if (u) throw new Error(`Unknown config key: ${u}`); for (const k of allowed) if (c[k] === undefined || c[k] === "") throw new Error(`Missing ${k}`); }
export function createOperationsActions({ jobs, alerts }: { jobs: JobActionPort; alerts: AlertPort }): ActionAdapter[] {
  const retry: ActionAdapter = { type: "job.retry", sensitive: false, validate(c) { strict(c, ["jobId"]); }, async preview(c) { this.validate(c); return { jobId: c.jobId, operation: "retry once" }; }, async execute(c, x) { this.validate(c); return jobs.retry(String(c.jobId), x.idempotencyKey); }, async compensate(_c, r, x) { const alert = await alerts.create({ type: "automation.retry_manual_verification", priority: "high", jobId: r.jobId, message: "A retried job cannot be recalled; verify its outcome manually" }, x.idempotencyKey); return { alertId: alert.alertId }; } };
  const alert: ActionAdapter = { type: "operations.alert", sensitive: false, validate(c) { strict(c, ["message", "priority"]); if (!["low", "medium", "high"].includes(String(c.priority))) throw new Error("Invalid priority"); }, async preview(c) { this.validate(c); return { ...c }; }, async execute(c, x) { this.validate(c); return alerts.create(c, x.idempotencyKey); }, async compensate(_c, r, x) { await alerts.resolve(String(r.alertId), "Resolved because of automation rollback", x.idempotencyKey); return { resolved: true }; } };
  return [retry, alert];
}
