import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAction, resetActionRegistryForTests } from "../src/modules/automation/action-registry.js";
import { createTaskActions } from "../src/modules/automation/actions/task.actions.js";
import { createGithubActions } from "../src/modules/automation/actions/github.actions.js";
import { createNotificationActions } from "../src/modules/automation/actions/notification.actions.js";
import { createOperationsActions } from "../src/modules/automation/actions/operations.actions.js";
import { registerAutomationActions } from "../src/modules/automation/actions/register-actions.js";
import type { ActionContext } from "../src/modules/automation/action-registry.js";
import { readFileSync } from "node:fs";
import { MongoActionEffectStore } from "../src/modules/automation/actions/production-deps.js";

const context: ActionContext = { executionId: "e", idempotencyKey: "stable", event: { eventId: "event", type: "task.updated", source: "audit", occurredAt: "2026-01-01T00:00:00Z", scope: {}, payload: {} } };
const alerts = { create: vi.fn(async () => ({ alertId: "alert-1" })), resolve: vi.fn(async () => undefined) };

describe("automation action adapters", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.NODE_ENV = "test"; resetActionRegistryForTests(); });

  it("strictly validates configs and previews without integrations", async () => {
    const tasks = { create: vi.fn(), update: vi.fn(), assign: vi.fn(), deleteIfVersion: vi.fn(), restoreIfVersion: vi.fn() };
    const [create] = createTaskActions({ tasks, alerts });
    expect(() => create.validate({ title: "x", surprise: true })).toThrow(/unknown/i);
    expect(() => create.validate({})).toThrow();
    await expect(create.preview({ title: "x" }, context.event)).resolves.toMatchObject({ title: "x" });
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it("task create propagates idempotency and alerts rather than deleting a changed task", async () => {
    const tasks = { create: vi.fn(async (_v, key) => ({ taskId: "t", version: 2, idempotencyKey: key })), update: vi.fn(), assign: vi.fn(), deleteIfVersion: vi.fn(async () => false), restoreIfVersion: vi.fn() };
    const [action] = createTaskActions({ tasks, alerts });
    const result = await action.execute({ title: "x" }, context);
    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({ title: "x" }), "stable");
    await action.compensate({ title: "x" }, result, context);
    expect(alerts.create).toHaveBeenCalledWith(expect.objectContaining({ type: "automation.rollback_conflict", taskId: "t" }), "stable:conflict");
  });

  it("task update and assign restore snapshots with compare-and-set and alert on conflict", async () => {
    const tasks = { create: vi.fn(), update: vi.fn(async () => ({ taskId: "t", previous: { priority: "low" }, version: 4 })), assign: vi.fn(async () => ({ taskId: "t", previous: { assignee: "old" }, version: 5 })), deleteIfVersion: vi.fn(), restoreIfVersion: vi.fn(async () => false) };
    const actions = createTaskActions({ tasks, alerts });
    for (const [action, config] of [[actions[1], { taskId: "t", changes: { priority: "high" } }], [actions[2], { taskId: "t", assignee: "new" }]] as const) {
      const result = await action.execute(config, context); await action.compensate(config, result, context);
    }
    expect(tasks.restoreIfVersion).toHaveBeenCalledTimes(2);
    expect(alerts.create).toHaveBeenCalledTimes(2);
    expect(actions[2].sensitive).toBe(true);
  });

  it("restores reviewers and uses GitHub comment correction fallback", async () => {
    const github = { setReviewers: vi.fn(async () => ({ previousReviewers: ["old"] })), addComment: vi.fn(async () => ({ commentId: "c", canDelete: false, canEdit: false })), deleteComment: vi.fn(), editComment: vi.fn(), addCorrection: vi.fn() };
    const [reviewer, comment] = createGithubActions({ github });
    await reviewer.compensate({ repository: "o/r", number: 1, reviewers: ["new"] }, await reviewer.execute({ repository: "o/r", number: 1, reviewers: ["new"] }, context), context);
    expect(github.setReviewers).toHaveBeenLastCalledWith("o/r", 1, ["old"], "stable");
    const result = await comment.execute({ repository: "o/r", number: 1, body: "hello" }, context);
    await comment.compensate({ repository: "o/r", number: 1, body: "hello" }, result, context);
    expect(github.addCorrection).toHaveBeenCalledWith("o/r", 1, "c", expect.stringMatching(/rollback/i), "stable");
  });

  it("notifications correct originals, retries alert for verification, and alert rollback resolves", async () => {
    const notifications = { send: vi.fn(async () => ({ messageId: "m" })), sendCorrection: vi.fn() };
    const [notification] = createNotificationActions({ notifications });
    await notification.compensate({ channel: "ops", message: "x" }, await notification.execute({ channel: "ops", message: "x" }, context), context);
    expect(notifications.sendCorrection).toHaveBeenCalledWith("m", expect.stringMatching(/rollback/i), "stable");
    const jobs = { retry: vi.fn(async () => ({ jobId: "j" })) };
    const [retry, alert] = createOperationsActions({ jobs, alerts });
    await retry.compensate({ jobId: "j" }, await retry.execute({ jobId: "j" }, context), context);
    expect(alerts.create).toHaveBeenCalledWith(expect.objectContaining({ type: "automation.retry_manual_verification" }), "stable");
    await alert.compensate({ message: "bad", priority: "high" }, await alert.execute({ message: "bad", priority: "high" }, context), context);
    expect(alerts.resolve).toHaveBeenCalledWith("alert-1", expect.stringMatching(/rollback/i), "stable");
  });

  it("registers all eight types once and server registers before worker start", () => {
    const deps = { tasks: { create: vi.fn(), update: vi.fn(), assign: vi.fn(), deleteIfVersion: vi.fn(), restoreIfVersion: vi.fn() }, github: { setReviewers: vi.fn(), addComment: vi.fn(), deleteComment: vi.fn(), editComment: vi.fn(), addCorrection: vi.fn() }, notifications: { send: vi.fn(), sendCorrection: vi.fn() }, jobs: { retry: vi.fn() }, alerts };
    registerAutomationActions(deps); registerAutomationActions(deps);
    for (const type of ["task.create", "task.update", "task.assign", "github.assign_reviewer", "github.comment", "notification.send", "job.retry", "operations.alert"] as const) expect(getAction(type).type).toBe(type);
    const source = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
    expect(source.indexOf("registerAutomationActions(")).toBeGreaterThan(-1);
    expect(source.indexOf("registerAutomationActions(")).toBeLessThan(source.indexOf("automationWorker.start()"));
  });
});

describe("production action effects", () => {
  it("returns a completed effect without invoking the operation twice", async () => {
    const documents = new Map<string, Record<string, unknown>>();
    const collection = {
      findOne: vi.fn(async ({ _id }: { _id: string }) => documents.get(_id)),
      insertOne: vi.fn(async (value: Record<string, unknown>) => { if (documents.has(String(value._id))) throw Object.assign(new Error("duplicate"), { code: 11000 }); documents.set(String(value._id), value); }),
      updateOne: vi.fn(async ({ _id }: { _id: string }, update: { $set: Record<string, unknown> }) => { documents.set(_id, { ...documents.get(_id), ...update.$set }); }),
      deleteOne: vi.fn(),
    };
    const store = new MongoActionEffectStore({ collection: () => collection } as never);
    const operation = vi.fn(async () => ({ taskId: "t" }));
    await expect(store.run("same", operation)).resolves.toEqual({ taskId: "t" });
    await expect(store.run("same", operation)).resolves.toEqual({ taskId: "t" });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
