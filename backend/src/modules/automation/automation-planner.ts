import { createHash } from "node:crypto";
import type { AutomationEvent, AutomationRule, ExecutionPlan } from "./automation.model.js";
import { getAction } from "./action-registry.js";

function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalSerialize(entryValue)}`).join(",")}}`;
}

export async function planExecution(rule: AutomationRule, event: AutomationEvent): Promise<ExecutionPlan> {
  const actions = [];

  for (const action of rule.actions) {
    const adapter = getAction(action.type);
    adapter.validate(action.config);
    const preview = await adapter.preview(action.config, event);
    actions.push({
      ...action,
      sensitive: adapter.sensitive || action.approvalRequired === true,
      compensationType: action.type,
      preview,
    });
  }

  const approvalInput = {
    event: {
      eventId: event.eventId,
      type: event.type,
      scope: event.scope,
      payload: event.payload,
    },
    actions: actions.map(({ id, type, config, preview, sensitive }) => ({ id, type, config, preview, sensitive })),
  };

  return {
    actions,
    requiresApproval: actions.some((action) => action.sensitive),
    inputFingerprint: createHash("sha256").update(canonicalSerialize(approvalInput)).digest("hex"),
  };
}
