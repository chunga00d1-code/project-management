import type { ActionType, AutomationEvent } from "./automation.model.js";

export interface ActionContext {
  event: AutomationEvent;
  executionId: string;
  idempotencyKey: string;
}

export interface ActionAdapter {
  type: ActionType;
  sensitive: boolean;
  validate(config: Record<string, unknown>): void;
  preview(config: Record<string, unknown>, event: AutomationEvent): Promise<Record<string, unknown>>;
  execute(config: Record<string, unknown>, context: ActionContext): Promise<Record<string, unknown>>;
  compensate(
    config: Record<string, unknown>,
    result: Record<string, unknown>,
    context: ActionContext,
  ): Promise<Record<string, unknown>>;
}

const registry = new Map<ActionType, ActionAdapter>();

export function registerAction(adapter: ActionAdapter): void {
  registry.set(adapter.type, adapter);
}

export function getAction(type: ActionType): ActionAdapter {
  const adapter = registry.get(type);
  if (!adapter) throw new Error(`Unsupported automation action: ${type}`);
  return adapter;
}

export function resetActionRegistryForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The automation action registry can only be reset in tests");
  }
  registry.clear();
}
