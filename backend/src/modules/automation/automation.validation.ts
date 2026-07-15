import { ValidationError, object, text } from "../../core/validation.js";
import type { ActionType, AutomationRule, Comparator, ConditionNode, RuleAction, TriggerType } from "./automation.model.js";

const triggers: TriggerType[] = ["pr.opened", "pr.updated", "pr.merged", "pr.closed", "pr.review_changed", "task.created", "task.updated", "task.status_changed", "task.due_soon", "task.overdue", "integration.failed", "schedule.tick"];
const actions: ActionType[] = ["task.create", "task.update", "task.assign", "github.assign_reviewer", "github.comment", "notification.send", "job.retry", "operations.alert"];
const comparators: Comparator[] = ["eq", "neq", "in", "contains", "gt", "gte", "lt", "lte", "exists"];
const scopeTypes = ["system", "repository", "project", "team"] as const;

export type AutomationRuleInput = Pick<AutomationRule, "name" | "scope" | "trigger" | "conditions" | "actions"> &
  Partial<Pick<AutomationRule, "description" | "enabled" | "priority" | "effectiveFrom" | "effectiveUntil">>;

function fail(message: string): never {
  throw new ValidationError(message);
}

function condition(value: unknown, count: { value: number }): ConditionNode {
  count.value += 1;
  if (count.value > 50) fail("Too many automation condition nodes");
  const node = object(value);
  if (node.operator !== undefined) {
    if ((node.operator !== "and" && node.operator !== "or") || !Array.isArray(node.children) || node.children.length === 0) fail("Invalid automation conditions");
    return { operator: node.operator, children: node.children.map((child) => condition(child, count)) };
  }
  if (typeof node.field !== "string" || !node.field.trim() || typeof node.comparator !== "string" || !comparators.includes(node.comparator as Comparator)) fail("Invalid automation conditions");
  const comparator = node.comparator as Comparator;
  if ((comparator === "eq" || comparator === "neq" || comparator === "contains") && node.value === undefined) fail("Invalid automation conditions");
  if (comparator === "in" && !Array.isArray(node.value)) fail("Invalid automation conditions");
  if (["gt", "gte", "lt", "lte"].includes(comparator) && (typeof node.value !== "number" || !Number.isFinite(node.value))) fail("Invalid automation conditions");
  if (comparator === "exists" && node.value !== undefined && typeof node.value !== "boolean") fail("Invalid automation conditions");
  return { field: node.field.trim(), comparator, ...(node.value !== undefined ? { value: node.value } : {}) };
}

function ruleAction(value: unknown): RuleAction {
  const input = object(value);
  if (typeof input.type !== "string" || !actions.includes(input.type as ActionType)) fail(`Unsupported automation action: ${String(input.type)}`);
  if (typeof input.id !== "string" || !input.id.trim()) fail("Invalid automation action id");
  if (!input.config || typeof input.config !== "object" || Array.isArray(input.config)) fail("Invalid automation action config");
  if (!input.retry || typeof input.retry !== "object" || Array.isArray(input.retry)) fail("Invalid automation retry policy");
  const retry = input.retry as Record<string, unknown>;
  if (!Number.isInteger(retry.maxAttempts) || (retry.maxAttempts as number) < 1 || (retry.maxAttempts as number) > 8 ||
      !Number.isInteger(retry.baseDelayMs) || (retry.baseDelayMs as number) < 1000 || (retry.baseDelayMs as number) > 3600000) fail("Invalid automation retry policy");
  if (input.approvalRequired !== undefined && typeof input.approvalRequired !== "boolean") fail("Invalid automation action approval policy");
  return {
    id: input.id.trim(),
    type: input.type as ActionType,
    config: input.config as Record<string, unknown>,
    ...(input.approvalRequired !== undefined ? { approvalRequired: input.approvalRequired as boolean } : {}),
    retry: { maxAttempts: retry.maxAttempts as number, baseDelayMs: retry.baseDelayMs as number },
  };
}

export function parseRuleInput(value: unknown): AutomationRuleInput {
  const input = object(value);
  const name = text(input.name, "name", 120, true)!;
  const scope = object(input.scope);
  if (typeof scope.type !== "string" || !scopeTypes.includes(scope.type as typeof scopeTypes[number])) fail("Invalid automation scope");
  const scopeType = scope.type as typeof scopeTypes[number];
  if ((scope.type === "system" && scope.id !== undefined) || (scope.type !== "system" && (typeof scope.id !== "string" || !scope.id.trim()))) fail("Invalid automation scope");
  const trigger = object(input.trigger);
  if (typeof trigger.type !== "string" || !triggers.includes(trigger.type as TriggerType)) fail("Invalid automation trigger");
  if (!Array.isArray(input.actions) || input.actions.length === 0) fail("Invalid automation actions");
  if (input.actions.length > 20) fail("Too many automation actions");
  const parsedActions = input.actions.map(ruleAction);
  if (new Set(parsedActions.map((action) => action.id)).size !== parsedActions.length) fail("Duplicate automation action id");
  const parsedConditions = condition(input.conditions, { value: 0 });
  const description = text(input.description, "description", 2000);
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") fail("Invalid enabled");
  if (input.priority !== undefined && (typeof input.priority !== "number" || !Number.isFinite(input.priority) || !Number.isInteger(input.priority))) fail("Invalid priority");
  const timestamp = (field: "effectiveFrom" | "effectiveUntil") => {
    const value = input[field];
    if (value === undefined) return undefined;
    if (typeof value !== "string") fail(`Invalid ${field}`);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) fail(`Invalid ${field}`);
    return value;
  };
  const effectiveFrom = timestamp("effectiveFrom");
  const effectiveUntil = timestamp("effectiveUntil");
  if (effectiveFrom && effectiveUntil && Date.parse(effectiveUntil) < Date.parse(effectiveFrom)) fail("effectiveUntil must not be before effectiveFrom");
  return {
    name,
    scope: scopeType === "system" ? { type: "system" } : { type: scopeType, id: (scope.id as string).trim() },
    trigger: { type: trigger.type as TriggerType },
    conditions: parsedConditions,
    actions: parsedActions,
    ...(description !== undefined ? { description } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
    ...(effectiveUntil !== undefined ? { effectiveUntil } : {}),
  };
}
