import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionType, AutomationEvent, AutomationRule } from "../src/modules/automation/automation.model.js";
import {
  registerAction,
  resetActionRegistryForTests,
  type ActionAdapter,
} from "../src/modules/automation/action-registry.js";
import { planExecution } from "../src/modules/automation/automation-planner.js";

const event = (payload: Record<string, unknown> = { task: { id: "task-1", priority: "high" } }): AutomationEvent => ({
  eventId: "event-1",
  type: "task.updated",
  source: "audit",
  occurredAt: "2026-07-15T00:00:00.000Z",
  actor: "user-1",
  scope: { projectId: "project-1" },
  payload,
});

const rule = (types: ActionType[], configs: Record<string, unknown>[] = []): AutomationRule => ({
  _id: "rule-1",
  versionId: "version-1",
  version: 1,
  name: "Test rule",
  enabled: true,
  priority: 1,
  scope: { type: "system" },
  trigger: { type: "task.updated" },
  conditions: { field: "task.id", comparator: "exists" },
  actions: types.map((type, index) => ({
    id: `action-${index}`,
    type,
    config: configs[index] ?? { index },
    retry: { maxAttempts: 2, baseDelayMs: 1000 },
  })),
  createdBy: "admin-1",
  createdAt: "2026-07-15T00:00:00.000Z",
});

const adapter = (type: ActionType, sensitive = false) => ({
  type,
  sensitive,
  validate: vi.fn(),
  preview: vi.fn(async (config: Record<string, unknown>) => ({ summary: type, config })),
  execute: vi.fn(async () => ({ executed: true })),
  compensate: vi.fn(async () => ({ compensated: true })),
}) satisfies ActionAdapter;

afterEach(() => resetActionRegistryForTests());

describe("automation execution planner", () => {
  it("requires approval for a sensitive adapter and keeps a stable compensation type", async () => {
    registerAction(adapter("github.comment", true));
    const plan = await planExecution(rule(["github.comment"]), event());

    expect(plan.requiresApproval).toBe(true);
    expect(plan.actions[0]).toMatchObject({ sensitive: true, compensationType: "github.comment" });
    expect(plan.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires approval when a safe action explicitly requests it", async () => {
    registerAction(adapter("notification.send"));
    const input = rule(["notification.send"]);
    input.actions[0].approvalRequired = true;

    const plan = await planExecution(input, event());
    expect(plan.requiresApproval).toBe(true);
    expect(plan.actions[0].sensitive).toBe(true);
  });

  it("does not require approval for a safe-only plan", async () => {
    registerAction(adapter("task.update"));
    const plan = await planExecution(rule(["task.update"]), event());
    expect(plan.requiresApproval).toBe(false);
    expect(plan.actions[0].sensitive).toBe(false);
  });

  it("validates and previews in rule order without executing side effects", async () => {
    const calls: string[] = [];
    const first = adapter("task.create");
    const second = adapter("operations.alert");
    first.validate.mockImplementation(() => { calls.push("validate:first"); });
    first.preview.mockImplementation(async () => { calls.push("preview:first"); return { position: 1 }; });
    second.validate.mockImplementation(() => { calls.push("validate:second"); });
    second.preview.mockImplementation(async () => { calls.push("preview:second"); return { position: 2 }; });
    registerAction(first);
    registerAction(second);

    const inputRule = rule(["task.create", "operations.alert"], [{ title: "One" }, { title: "Two" }]);
    const inputEvent = event();
    const plan = await planExecution(inputRule, inputEvent);

    expect(calls).toEqual(["validate:first", "preview:first", "validate:second", "preview:second"]);
    expect(first.validate).toHaveBeenCalledWith(inputRule.actions[0].config);
    expect(first.preview).toHaveBeenCalledWith(inputRule.actions[0].config, inputEvent);
    expect(plan.actions.map(({ id }) => id)).toEqual(["action-0", "action-1"]);
    expect(first.execute).not.toHaveBeenCalled();
    expect(first.compensate).not.toHaveBeenCalled();
    expect(second.execute).not.toHaveBeenCalled();
    expect(second.compensate).not.toHaveBeenCalled();
  });

  it("fails fast for unsupported actions and invalid configuration", async () => {
    await expect(planExecution(rule(["job.retry"]), event())).rejects.toThrow("Unsupported automation action: job.retry");

    const invalid = adapter("task.assign");
    invalid.validate.mockImplementation(() => { throw new Error("assignee is required"); });
    registerAction(invalid);
    await expect(planExecution(rule(["task.assign"]), event())).rejects.toThrow("assignee is required");
    expect(invalid.preview).not.toHaveBeenCalled();
  });

  it("canonicalizes object keys while retaining payload significance", async () => {
    registerAction(adapter("notification.send"));
    const first = await planExecution(rule(["notification.send"], [{ b: 2, a: { y: 2, x: 1 } }]), event({ b: 2, a: 1 }));
    const reordered = await planExecution(rule(["notification.send"], [{ a: { x: 1, y: 2 }, b: 2 }]), event({ a: 1, b: 2 }));
    const changed = await planExecution(rule(["notification.send"], [{ a: { x: 1, y: 2 }, b: 2 }]), event({ a: 1, b: 3 }));

    expect(reordered.inputFingerprint).toBe(first.inputFingerprint);
    expect(changed.inputFingerprint).not.toBe(first.inputFingerprint);
  });

  it("retains action order in the fingerprint", async () => {
    registerAction(adapter("task.create"));
    registerAction(adapter("task.update"));
    const forward = await planExecution(rule(["task.create", "task.update"]), event());
    const reverse = await planExecution(rule(["task.update", "task.create"]), event());
    expect(reverse.inputFingerprint).not.toBe(forward.inputFingerprint);
  });
});
