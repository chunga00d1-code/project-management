import type { ActionAdapter } from "../action-registry.js";

export interface TaskActionPort {
  create(input: Record<string, unknown>, idempotencyKey: string): Promise<{ taskId: string; version: string | number }>;
  update(taskId: string, changes: Record<string, unknown>, idempotencyKey: string): Promise<{ taskId: string; previous: Record<string, unknown>; version: string | number }>;
  assign(taskId: string, assignee: string, idempotencyKey: string): Promise<{ taskId: string; previous: Record<string, unknown>; version: string | number }>;
  deleteIfVersion(taskId: string, version: string | number, idempotencyKey: string): Promise<boolean>;
  restoreIfVersion(taskId: string, expectedVersion: string | number, snapshot: Record<string, unknown>, idempotencyKey: string): Promise<boolean>;
}
export interface AlertPort { create(input: Record<string, unknown>, idempotencyKey: string): Promise<{ alertId: string }>; resolve(alertId: string, reason: string, idempotencyKey: string): Promise<void>; }

function object(value: unknown, name: string): asserts value is Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`); }
function validate(config: Record<string, unknown>, required: string[], allowed: string[]) { object(config, "config"); const unknown = Object.keys(config).filter(k => !allowed.includes(k)); if (unknown.length) throw new Error(`Unknown config key: ${unknown[0]}`); for (const key of required) if (config[key] === undefined || config[key] === "") throw new Error(`Missing ${key}`); }
function validId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}
function validText(value: unknown, name: string, maximum: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) throw new Error(`Invalid ${name}`);
  return value;
}
function validLabels(value: unknown): void {
  if (!Array.isArray(value) || value.some(label => typeof label !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(label))) throw new Error("Invalid labels");
}
async function conflict(alerts: AlertPort, taskId: string, key: string) { await alerts.create({ type: "automation.rollback_conflict", taskId, priority: "high", message: "Task changed after automation; rollback was not applied" }, `${key}:conflict`); }

export function createTaskActions(deps: { tasks: TaskActionPort; alerts: AlertPort }): ActionAdapter[] {
  const create: ActionAdapter = { type: "task.create", sensitive: false,
    validate(c) { validate(c, ["title"], ["title", "description", "priority", "labels", "projectId"]); validText(c.title, "title", 500); if (c.description !== undefined && typeof c.description !== "string") throw new Error("Invalid description"); if (c.priority !== undefined && !["low", "medium", "high", "urgent"].includes(String(c.priority))) throw new Error("Invalid priority"); if (c.labels !== undefined) validLabels(c.labels); if (c.projectId !== undefined) validId(c.projectId, "projectId"); },
    async preview(c) { this.validate(c); return { ...c, operation: "create task" }; },
    async execute(c, x) { this.validate(c); return deps.tasks.create(c, x.idempotencyKey); },
    async compensate(_c, r, x) { const ok = await deps.tasks.deleteIfVersion(String(r.taskId), r.version as string | number, x.idempotencyKey); if (!ok) await conflict(deps.alerts, String(r.taskId), x.idempotencyKey); return { deleted: ok }; } };
  const update: ActionAdapter = { type: "task.update", sensitive: false,
    validate(c) { validate(c, ["taskId", "changes"], ["taskId", "changes"]); validId(c.taskId, "taskId"); object(c.changes, "changes"); const safe = ["priority", "labels"]; if (Object.keys(c.changes).some(k => !safe.includes(k))) throw new Error("task.update only supports priority and labels"); if (c.changes.priority !== undefined && !["low", "medium", "high", "urgent"].includes(String(c.changes.priority))) throw new Error("Invalid priority"); if (c.changes.labels !== undefined) validLabels(c.changes.labels); },
    async preview(c) { this.validate(c); return { taskId: c.taskId, changes: c.changes }; },
    async execute(c, x) { this.validate(c); return deps.tasks.update(String(c.taskId), c.changes as Record<string, unknown>, x.idempotencyKey); },
    async compensate(_c, r, x) { const ok = await deps.tasks.restoreIfVersion(String(r.taskId), r.version as string | number, r.previous as Record<string, unknown>, x.idempotencyKey); if (!ok) await conflict(deps.alerts, String(r.taskId), x.idempotencyKey); return { restored: ok }; } };
  const assign: ActionAdapter = { type: "task.assign", sensitive: true,
    validate(c) { validate(c, ["taskId", "assignee"], ["taskId", "assignee"]); validId(c.taskId, "taskId"); if (typeof c.assignee !== "string" || !/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})|[^@\\s]+@[^@\\s]+\\.[^@\\s]+)$/.test(c.assignee)) throw new Error("Invalid assignee"); },
    async preview(c) { this.validate(c); return { taskId: c.taskId, assignee: c.assignee }; },
    async execute(c, x) { this.validate(c); return deps.tasks.assign(String(c.taskId), String(c.assignee), x.idempotencyKey); },
    async compensate(_c, r, x) { const ok = await deps.tasks.restoreIfVersion(String(r.taskId), r.version as string | number, r.previous as Record<string, unknown>, x.idempotencyKey); if (!ok) await conflict(deps.alerts, String(r.taskId), x.idempotencyKey); return { restored: ok }; } };
  return [create, update, assign];
}
