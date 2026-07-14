import type { Priority, TaskModel, TaskStatus } from "../modules/tasks/task.model.js";
import type { Role } from "./auth.js";

export class ValidationError extends Error {}

const statuses: TaskStatus[] = ["todo", "in_review", "needs_changes", "ready", "done", "cancelled"];
const priorities: Priority[] = ["low", "medium", "high", "urgent"];
const roles: Role[] = ["superadmin", "admin", "manager", "developer"];

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Invalid request body");
  return value as Record<string, unknown>;
}

export function text(value: unknown, name: string, max: number, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) throw new ValidationError(`Invalid ${name}`);
  return value.trim();
}

function isoTimestamp(value: unknown, name: "startAt" | "dueAt") {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ValidationError(`Invalid ${name}`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new ValidationError(`Invalid ${name}`);
  return value;
}

export function taskInput(value: unknown, mode: "create" | "update") {
  const body = object(value);
  const currentFields = ["title", "description", "assignee", "status", "priority", "startAt", "dueAt", "labels", "project", "projectId", "repository"];
  const legacyUpdateFields = ["dueDate", "sprint", "team"];
  const allowed = mode === "create" ? currentFields : [...currentFields, ...legacyUpdateFields];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new ValidationError("Unsupported task field");

  const result: Partial<TaskModel> = {};
  const title = text(body.title, "title", 200, mode === "create");
  if (title !== undefined) result.title = title;
  const description = text(body.description, "description", 10000);
  if (description !== undefined) result.description = description;
  const assignee = text(body.assignee, "assignee", 200);
  if (assignee !== undefined) result.assignee = assignee;

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !statuses.includes(body.status as TaskStatus)) throw new ValidationError("Invalid status");
    result.status = body.status as TaskStatus;
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !priorities.includes(body.priority as Priority)) throw new ValidationError("Invalid priority");
    result.priority = body.priority as Priority;
  }

  const startAt = isoTimestamp(body.startAt, "startAt");
  const dueAt = isoTimestamp(body.dueAt, "dueAt");
  if (startAt !== undefined) result.startAt = startAt;
  if (dueAt !== undefined) result.dueAt = dueAt;
  if (startAt && dueAt && Date.parse(dueAt) <= Date.parse(startAt)) throw new ValidationError("Deadline must be later than start time");

  if (mode === "update" && body.dueDate !== undefined) {
    if (typeof body.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) throw new ValidationError("Invalid dueDate");
    result.dueDate = body.dueDate;
  }

  for (const field of ["project", "projectId", "repository"] as const) {
    const fieldValue = text(body[field], field, 200);
    if (fieldValue !== undefined) result[field] = fieldValue;
  }
  if (mode === "update") {
    for (const field of ["sprint", "team"] as const) {
      const fieldValue = text(body[field], field, 100);
      if (fieldValue !== undefined) result[field] = fieldValue;
    }
  }
  if (body.labels !== undefined) {
    if (!Array.isArray(body.labels) || body.labels.length > 20 || body.labels.some((item) => typeof item !== "string" || item.length > 50)) throw new ValidationError("Invalid labels");
    result.labels = body.labels.map((item) => item.trim()).filter(Boolean);
  }
  return result;
}

export function userInput(value: unknown) {
  const body = object(value);
  if (Object.keys(body).some((key) => !["email", "password", "role"].includes(key))) throw new ValidationError("Unsupported user field");
  const email = text(body.email, "email", 254, true)?.toLowerCase();
  const password = text(body.password, "password", 128, true);
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 12) throw new ValidationError("Email or password is invalid");
  if (typeof body.role !== "string" || !roles.includes(body.role as Role) || body.role === "superadmin") throw new ValidationError("Invalid role");
  return { email, password, role: body.role as Role };
}
