import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAction, resetActionRegistryForTests } from "../src/modules/automation/action-registry.js";
import { createTaskActions } from "../src/modules/automation/actions/task.actions.js";
import { createGithubActions } from "../src/modules/automation/actions/github.actions.js";
import { createNotificationActions } from "../src/modules/automation/actions/notification.actions.js";
import { createOperationsActions } from "../src/modules/automation/actions/operations.actions.js";
import { registerAutomationActions } from "../src/modules/automation/actions/register-actions.js";
import type { ActionContext } from "../src/modules/automation/action-registry.js";
import { readFileSync } from "node:fs";
import { MongoActionEffectStore, createProductionAutomationActionDependencies } from "../src/modules/automation/actions/production-deps.js";
vi.mock("../src/modules/github-app/github-token.service.js", () => ({ resolveGithubToken: vi.fn(async () => "token") }));

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
    const github = { setReviewers: vi.fn(async () => ({ previous: { users: ["old"], teams: ["old-team"] } })), addComment: vi.fn(async () => ({ commentId: "c", canDelete: false, canEdit: false })), deleteComment: vi.fn().mockRejectedValue(new Error("delete denied")), editComment: vi.fn().mockRejectedValue(new Error("edit denied")), addCorrection: vi.fn() };
    const [reviewer, comment] = createGithubActions({ github });
    await reviewer.compensate({ repository: "o/r", number: 1, reviewers: ["new"] }, await reviewer.execute({ repository: "o/r", number: 1, reviewers: ["new"] }, context), context);
    expect(github.setReviewers).toHaveBeenLastCalledWith("o/r", 1, ["old"], ["old-team"], "stable");
    const result = await comment.execute({ repository: "o/r", number: 1, body: "hello" }, context);
    await comment.compensate({ repository: "o/r", number: 1, body: "hello" }, result, context);
    expect(github.addCorrection).toHaveBeenCalledWith("o/r", 1, "c", expect.stringMatching(/rollback/i), "stable");
  });

  it("notifications correct originals, retries alert for verification, and alert rollback resolves", async () => {
    const notifications = { send: vi.fn(async () => ({ messageId: "m" })), sendCorrection: vi.fn() };
    const [notification] = createNotificationActions({ notifications });
    await notification.compensate({ channel: "ops", message: "x" }, await notification.execute({ channel: "ops", message: "x" }, context), context);
    expect(notifications.sendCorrection).toHaveBeenCalledWith("m", expect.stringMatching(/rollback/i), "stable");
    const jobs = { retry: vi.fn(async () => ({ jobId: "0123456789abcdef01234567" })) };
    const [retry, alert] = createOperationsActions({ jobs, alerts });
    await retry.compensate({ jobId: "0123456789abcdef01234567" }, await retry.execute({ jobId: "0123456789abcdef01234567" }, context), context);
    expect(alerts.create).toHaveBeenCalledWith(expect.objectContaining({ type: "automation.retry_manual_verification" }), "stable");
    await alert.compensate({ message: "bad", priority: "high" }, await alert.execute({ message: "bad", priority: "high" }, context), context);
    expect(alerts.resolve).toHaveBeenCalledWith("alert-1", expect.stringMatching(/rollback/i), "stable");
  });

  it("registers all eight types once and server registers before worker start", () => {
    const deps = { tasks: { create: vi.fn(), update: vi.fn(), assign: vi.fn(), deleteIfVersion: vi.fn(), restoreIfVersion: vi.fn() }, github: { setReviewers: vi.fn(), addComment: vi.fn(), deleteComment: vi.fn().mockRejectedValue(new Error("delete denied")), editComment: vi.fn().mockRejectedValue(new Error("edit denied")), addCorrection: vi.fn() }, notifications: { send: vi.fn(), sendCorrection: vi.fn() }, jobs: { retry: vi.fn() }, alerts };
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
      updateOne: vi.fn(async ({ _id }: { _id: string }, update: { $set: Record<string, unknown> }) => { documents.set(_id, { ...documents.get(_id), ...update.$set }); return { matchedCount: 1 }; }),
      deleteOne: vi.fn(),
    };
    const store = new MongoActionEffectStore({ collection: () => collection } as never);
    const operation = vi.fn(async () => ({ taskId: "t" }));
    await expect(store.run("task.create", "same", operation)).resolves.toEqual({ taskId: "t" });
    await expect(store.run("task.create", "same", operation)).resolves.toEqual({ taskId: "t" });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

it("separates execute and compensate effects even when the caller key matches", async () => {
  const documents = new Map<string, Record<string, unknown>>();
  const collection = {
    findOne: async ({ _id }: { _id: string }) => documents.get(_id),
    insertOne: async (value: Record<string, unknown>) => { documents.set(String(value._id), value); },
    updateOne: async ({ _id }: { _id: string }, update: { $set: Record<string, unknown> }) => { documents.set(_id, { ...documents.get(_id), ...update.$set }); return { matchedCount: 1 }; },
  };
  const store = new MongoActionEffectStore({ collection: () => collection } as never);
  const execute = vi.fn(async () => ({ phase: "execute" }));
  const compensate = vi.fn(async () => ({ phase: "compensate" }));
  await expect(store.run("task.create", "same", execute)).resolves.toEqual({ phase: "execute" });
  await expect(store.run("task.delete", "same", compensate)).resolves.toEqual({ phase: "compensate" });
  expect(execute).toHaveBeenCalledOnce();
  expect(compensate).toHaveBeenCalledOnce();
});


it("waits for a duplicate claimant and returns its completed result", async () => {
  let document: Record<string, unknown> = { _id: "task.create:k", status: "running", owner: "other", leaseUntil: new Date("2030-01-01") };
  const collection = {
    findOne: async () => document,
    insertOne: vi.fn(),
    updateOne: vi.fn(),
  };
  const wait = vi.fn(async () => { document = { ...document, status: "completed", result: { value: 1 } }; });
  const store = new MongoActionEffectStore({ collection: () => collection } as never, { now: () => new Date("2026-01-01"), wait, maxWaits: 2 });
  const operation = vi.fn();
  await expect(store.run("task.create", "k", operation)).resolves.toEqual({ value: 1 });
  expect(operation).not.toHaveBeenCalled();
});

it("reclaims stale running effects and marks a lost completion ambiguous", async () => {
  let document: Record<string, unknown> = { _id: "task.create:k", status: "running", owner: "old", leaseUntil: new Date("2025-01-01") };
  let updates = 0;
  const collection = {
    findOne: async () => document,
    insertOne: vi.fn(),
    updateOne: vi.fn(async (_filter: unknown, update: { $set: Record<string, unknown> }) => {
      updates++;
      document = { ...document, ...update.$set };
      return { matchedCount: updates === 1 ? 1 : 0 };
    }),
  };
  const store = new MongoActionEffectStore({ collection: () => collection } as never, { owner: "new", now: () => new Date("2026-01-01") });
  await expect(store.run("task.create", "k", async () => ({ value: 1 }))).rejects.toMatchObject({ code: "ambiguous" });
  expect(document.status).toBe("ambiguous");
});


it("rejects invalid values for every adapter and keeps previews side-effect free", async () => {
  const integrations = {
    tasks: { create: vi.fn(), update: vi.fn(), assign: vi.fn(), deleteIfVersion: vi.fn(), restoreIfVersion: vi.fn() },
    github: { setReviewers: vi.fn(), addComment: vi.fn(), deleteComment: vi.fn(), editComment: vi.fn(), addCorrection: vi.fn() },
    notifications: { send: vi.fn(), sendCorrection: vi.fn() },
    jobs: { retry: vi.fn() },
    alerts: { create: vi.fn(), resolve: vi.fn() },
  };
  const cases = [
    [createTaskActions(integrations)[0], { title: "   " }],
    [createTaskActions(integrations)[1], { taskId: "bad id", changes: { priority: "extreme" } }],
    [createTaskActions(integrations)[2], { taskId: "task", assignee: "bad assignee" }],
    [createGithubActions(integrations)[0], { repository: "https://evil.example/x", number: 1, reviewers: [] }],
    [createGithubActions(integrations)[1], { repository: "o/r", number: 0, body: "x" }],
    [createNotificationActions(integrations)[0], { channel: "bad channel", message: "x" }],
    [createOperationsActions(integrations)[0], { jobId: "not-an-object-id" }],
    [createOperationsActions(integrations)[1], { message: "", priority: "high" }],
  ] as const;
  for (const [adapter, invalid] of cases) expect(() => adapter.validate(invalid)).toThrow();

  const valid = createGithubActions(integrations)[1];
  await valid.preview({ repository: "owner/repo", number: 1, body: "safe" }, context.event);
  expect(integrations.github.addComment).not.toHaveBeenCalled();
});

it("registers again after the test registry is reset", () => {
  process.env.NODE_ENV = "test";
  const dependencies = {
    tasks: { create: vi.fn(), update: vi.fn(), assign: vi.fn(), deleteIfVersion: vi.fn(), restoreIfVersion: vi.fn() },
    github: { setReviewers: vi.fn(), addComment: vi.fn(), deleteComment: vi.fn(), editComment: vi.fn(), addCorrection: vi.fn() },
    notifications: { send: vi.fn(), sendCorrection: vi.fn() }, jobs: { retry: vi.fn() }, alerts: { create: vi.fn(), resolve: vi.fn() },
  };
  resetActionRegistryForTests();
  registerAutomationActions(dependencies);
  resetActionRegistryForTests();
  registerAutomationActions(dependencies);
  expect(getAction("github.comment").type).toBe("github.comment");
});

it("persists the reviewer snapshot before a partial GitHub failure and does not repeat the ambiguous effect", async () => {
  const databases = new Map<string, Map<string, Record<string, unknown>>>();
  const collection = (name: string) => {
    const documents = databases.get(name) ?? new Map<string, Record<string, unknown>>();
    databases.set(name, documents);
    return {
      findOne: async ({ _id }: { _id: unknown }) => documents.get(String(_id)),
      insertOne: async (value: Record<string, unknown>) => { if (documents.has(String(value._id))) throw Object.assign(new Error("duplicate"), { code: 11000 }); documents.set(String(value._id), value); return { insertedId: value._id }; },
      updateOne: async ({ _id }: { _id: unknown }, update: { $set: Record<string, unknown> }) => { const key = String(_id); const current = documents.get(key); if (!current) return { matchedCount: 0, modifiedCount: 0 }; documents.set(key, { ...current, ...update.$set }); return { matchedCount: 1, modifiedCount: 1 }; },
    };
  };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ requested_reviewers: [{ login: "old" }], requested_teams: [{ slug: "team" }] }), { status: 200 }))
    .mockResolvedValueOnce(new Response("denied", { status: 403 }));
  vi.stubGlobal("fetch", fetchMock);
  const dependencies = createProductionAutomationActionDependencies({ collection } as never);
  await expect(dependencies.github.setReviewers("owner/repo", 1, ["new"], [], "same")).rejects.toThrow(/403/);
  const snapshot = databases.get("automation_github_reviewer_snapshots")?.get("github.reviewers:same");
  expect(snapshot?.previous).toEqual({ users: ["old"], teams: ["team"] });
  await expect(dependencies.github.setReviewers("owner/repo", 1, ["new"], [], "same")).rejects.toMatchObject({ code: "ambiguous" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(databases.get("automation_operations_alerts")?.size).toBe(1);
  vi.unstubAllGlobals();
});
