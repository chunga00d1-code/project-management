import { createHash } from "node:crypto";
import type { AutomationEvent, AutomationRule, ExecutionPlan } from "./automation.model.js";
import { getAction } from "./action-registry.js";

function canonicalSerialize(value: unknown, ancestors = new Set<object>()): string {
  if (value === undefined) return "u";
  if (value === null) return "l";
  if (typeof value === "boolean") return value ? "b1" : "b0";
  if (typeof value === "string") return `s${value.length}:${value}`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "n:NaN";
    if (value === Infinity) return "n:+Infinity";
    if (value === -Infinity) return "n:-Infinity";
    if (Object.is(value, -0)) return "n:-0";
    return `n:${value}`;
  }
  if (typeof value !== "object") {
    throw new Error(`Unsupported value in automation fingerprint: ${typeof value}`);
  }
  if (ancestors.has(value)) throw new Error("Unsupported cyclic value in automation fingerprint");
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const entries = Array.from({ length: value.length }, (_, index) => (
        Object.hasOwn(value, index) ? canonicalSerialize(value[index], ancestors) : "h"
      ));
      return `a${value.length}:[${entries.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Unsupported object in automation fingerprint");
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `o${entries.length}:{${entries.map(([key, entryValue]) => (
      `${key.length}:${key}=${canonicalSerialize(entryValue, ancestors)}`
    )).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
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
