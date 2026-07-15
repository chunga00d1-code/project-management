import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutomationEvent, AutomationExecution, AutomationRule, ExecutionStatus } from "../src/modules/automation/automation.model.js";
import { registerAction, resetActionRegistryForTests } from "../src/modules/automation/action-registry.js";
import { AutomationService, type AutomationStore } from "../src/modules/automation/automation.service.js";
import { AutomationRepository } from "../src/modules/automation/automation.repository.js";
import { ensureIndexes } from "../src/core/database.js";

const input = (overrides: Record<string, unknown> = {}) => ({
  name: "Notify", scope: { type: "project" as const, id: "project-1" }, trigger: { type: "task.updated" as const },
  conditions: { field: "task.priority", comparator: "eq" as const, value: "urgent" },
  actions: [{ id: "notify", type: "notification.send" as const, config: {}, retry: { maxAttempts: 2, baseDelayMs: 1000 } }],
  ...overrides,
});
const event = (overrides: Partial<AutomationEvent> = {}): AutomationEvent => ({
  eventId: "event-1", type: "task.updated", source: "audit", occurredAt: "2026-07-15T00:00:00.000Z",
  scope: { projectId: "project-1" }, payload: { task: { priority: "urgent" } }, ...overrides,
});

class MemoryStore implements AutomationStore {
  drafts = new Map<string, AutomationRule>(); versions: AutomationRule[] = []; executions: AutomationExecution[] = []; events: AutomationEvent[] = [];
  async saveDraft(rule: AutomationRule) { this.drafts.set(rule._id, structuredClone(rule)); return structuredClone(rule); }
  async publish(ruleId: string, publishedAt: string) {
    const draft = this.drafts.get(ruleId); if (!draft) throw new Error("Rule not found");
    const snapshot = structuredClone({ ...draft, version: this.versions.filter((r) => r._id === ruleId).length + 1, versionId: `${ruleId}:v${this.versions.filter((r) => r._id === ruleId).length + 1}`, publishedAt });
    this.versions.push(snapshot); this.drafts.set(ruleId, structuredClone(snapshot)); return snapshot;
  }
  async findRule(ruleId: string) { return structuredClone(this.drafts.get(ruleId)); }
  async setEnabled(ruleId: string, enabled: boolean) { const rule = this.drafts.get(ruleId); if (!rule) return undefined; rule.enabled = enabled; return structuredClone(rule); }
  async findMatchingEnabledVersions(e: AutomationEvent) { return this.versions.filter((r) => r.enabled && r.trigger.type === e.type); }
  async persistEvent(e: AutomationEvent) { const existing = this.events.find((x) => x.eventId === e.eventId); if (existing) return { event: existing, inserted: false }; this.events.push(structuredClone(e)); return { event: e, inserted: true }; }
  async insertExecution(execution: AutomationExecution) { const existing = this.executions.find((x) => x.eventId === execution.eventId && x.ruleVersionId === execution.ruleVersionId); if (existing) return existing; this.executions.push(structuredClone(execution)); return execution; }
  async transitionExecution(id: string, expected: ExecutionStatus, next: ExecutionStatus) { const found = this.executions.find((x) => x._id === id && x.status === expected); if (!found) return undefined; found.status = next; return found; }
}

afterEach(() => resetActionRegistryForTests());
const service = (s = new MemoryStore(), sensitive = false) => {
  const adapter = { type: "notification.send" as const, sensitive, validate: vi.fn(), preview: vi.fn(async () => ({})), execute: vi.fn(async () => ({})), compensate: vi.fn(async () => ({})) };
  registerAction(adapter);
  return { s, adapter, api: new AutomationService(s, { now: () => new Date("2026-07-15T01:00:00.000Z"), id: (() => { let n = 0; return () => `id-${++n}`; })() }) };
};

describe("automation lifecycle", () => {
  it("publishes immutable, increasing snapshots while later edits remain drafts", async () => {
    const { s, api } = service(); const draft = await api.createDraft(input(), "admin");
    const v1 = await api.publish(draft._id); await api.createDraft(input({ name: "Edited" }), "admin", draft._id); const v2 = await api.publish(draft._id);
    expect([v1.version, v2.version]).toEqual([1, 2]); expect(s.versions[0].name).toBe("Notify"); expect(s.versions[1].name).toBe("Edited");
  });
  it("deduplicates repeated ingest and sets approval state", async () => {
    const { s, api } = service(new MemoryStore(), true); const d = await api.createDraft(input({ enabled: true }), "admin"); await api.publish(d._id);
    const first = await api.ingest(event()); const second = await api.ingest(event());
    expect(s.executions).toHaveLength(1); expect(first[0]._id).toBe(second[0]._id); expect(first[0].status).toBe("waiting_approval");
  });
  it("rejects nonmatching conditions and scope", async () => {
    const { api } = service(); const d = await api.createDraft(input({ enabled: true }), "admin"); await api.publish(d._id);
    expect(await api.ingest(event({ payload: { task: { priority: "low" } } }))).toEqual([]);
    expect(await api.ingest(event({ eventId: "event-2", scope: { projectId: "other" } }))).toEqual([]);
  });
  it("dry runs a draft without event or execution writes", async () => {
    const { s, api, adapter } = service(); const persist = vi.spyOn(s, "persistEvent"); const insert = vi.spyOn(s, "insertExecution");
    const result = await api.dryRun(input(), event());
    expect(result?.plan.actions).toHaveLength(1); expect(s.events).toEqual([]); expect(s.executions).toEqual([]);
    expect(persist).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled();
    expect(adapter.execute).not.toHaveBeenCalled(); expect(adapter.compensate).not.toHaveBeenCalled();
  });
  it("protects against source-rule loops and depth five", async () => {
    const { api } = service(); const d = await api.createDraft(input({ enabled: true }), "admin"); await api.publish(d._id);
    expect(await api.ingest(event({ automation: { executionId: "prior", sourceRuleId: d._id, depth: 1 } }))).toEqual([]);
    expect(await api.ingest(event({ eventId: "event-2", automation: { executionId: "prior", sourceRuleId: "other", depth: 5 } }))).toEqual([]);
  });
  it("updates only an execution in the expected state and leaves mismatches unchanged", async () => {
    let execution = { ...({} as AutomationExecution), _id: "execution-1", status: "running" as ExecutionStatus };
    const db = { collection: () => ({ findOneAndUpdate: async (filter: { _id: string; status: ExecutionStatus }, update: { $set: { status: ExecutionStatus } }) => {
      if (execution._id !== filter._id || execution.status !== filter.status) return null;
      execution = { ...execution, ...update.$set }; return execution;
    } }) };
    const repository = new AutomationRepository(db as never);
    expect((await repository.transitionExecution("execution-1", "running", "succeeded"))?.status).toBe("succeeded");
    expect(await repository.transitionExecution("execution-1", "running", "cancelled")).toBeUndefined();
    expect(execution.status).toBe("succeeded");
  });
});

it("creates the exact automation indexes", async () => {
  const calls: unknown[][] = []; const db = { collection: (name: string) => ({ createIndex: async (keys: unknown, options?: unknown) => { calls.push([name, keys, options]); } }) };
  await ensureIndexes(db as never);
  expect(calls.filter(([name]) => String(name).startsWith("automation_"))).toEqual([
    ["automation_rule_versions", { ruleId: 1, version: 1 }, { unique: true }],
    ["automation_rules", { enabled: 1, "trigger.type": 1, priority: -1 }, undefined],
    ["automation_executions", { eventId: 1, ruleVersionId: 1 }, { unique: true }],
    ["automation_executions", { status: 1, "lease.until": 1, updatedAt: 1 }, undefined],
    ["automation_events", { eventId: 1 }, { unique: true }],
    ["automation_action_effects", { _id: 1 }, { unique: true }],
    ["automation_events", { expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ]);
});

describe("automation Mongo repository publication", () => {
  it("stores draft fields separately without changing active matching metadata", async () => {
    let update: unknown;
    const db = { collection: () => ({ updateOne: async (_filter: unknown, value: unknown) => { update = value; } }) };
    const repository = new AutomationRepository(db as never);
    const draft = { ...({} as AutomationRule), _id: "rule-1", name: "Retargeted", enabled: false, priority: 99, trigger: { type: "task.created" as const } };
    await repository.saveDraft(draft);
    expect(update).toEqual({ $set: { draft } });
  });

  it("matches through active metadata and returns the immutable pointed snapshot, not the edited draft", async () => {
    let ruleFilter: unknown;
    const published = { ...({} as AutomationRule), _id: "version-1", ruleId: "rule-1", versionId: "version-1", name: "Published", trigger: { type: "task.updated" as const } };
    const db = { collection: (name: string) => name === "automation_rules" ? {
      find: (filter: unknown) => { ruleFilter = filter; return { sort: () => ({ toArray: async () => [{ _id: "rule-1", currentVersionId: "version-1", draft: { ...published, name: "Draft", trigger: { type: "task.created" } } }] }) }; },
    } : { find: () => ({ toArray: async () => [published] }) } };
    const repository = new AutomationRepository(db as never);
    const matches = await repository.findMatchingEnabledVersions(event());
    expect(ruleFilter).toMatchObject({ enabled: true, "trigger.type": "task.updated" });
    expect(matches).toHaveLength(1); expect(matches[0]).toMatchObject({ _id: "rule-1", name: "Published", trigger: { type: "task.updated" } });
  });
  it("rolls back a partially inserted version and rejects a concurrent pointer conflict", async () => {
    const inserted: unknown[] = []; let transactionCalls = 0;
    const current = { _id: "rule-1", draft: input({ enabled: true }), activeVersion: 1 };
    const db = { collection: (name: string) => name === "automation_rules" ? {
      findOne: async () => current,
      updateOne: async () => ({ matchedCount: 0 }),
    } : { insertOne: async (value: unknown) => { inserted.push(value); } } };
    const transaction = async (work: (session: object) => Promise<unknown>) => {
      transactionCalls += 1; try { return await work({}); } catch (error) { inserted.length = 0; throw error; }
    };
    const repository = new AutomationRepository(db as never, transaction);
    await expect(repository.publish("rule-1", "2026-07-15T01:00:00.000Z")).rejects.toThrow("concurrent publication");
    expect(transactionCalls).toBe(1); expect(inserted).toEqual([]);
  });
});
