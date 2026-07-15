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
  registerAction({ type: "notification.send", sensitive, validate() {}, async preview() { return {}; }, async execute() { throw new Error("must not execute"); }, async compensate() { throw new Error("must not compensate"); } });
  return { s, api: new AutomationService(s, { now: () => new Date("2026-07-15T01:00:00.000Z"), id: (() => { let n = 0; return () => `id-${++n}`; })() }) };
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
    const { s, api } = service(); const result = await api.dryRun(input(), event());
    expect(result?.plan.actions).toHaveLength(1); expect(s.events).toEqual([]); expect(s.executions).toEqual([]);
  });
  it("protects against source-rule loops and depth five", async () => {
    const { api } = service(); const d = await api.createDraft(input({ enabled: true }), "admin"); await api.publish(d._id);
    expect(await api.ingest(event({ automation: { executionId: "prior", sourceRuleId: d._id, depth: 1 } }))).toEqual([]);
    expect(await api.ingest(event({ eventId: "event-2", automation: { executionId: "prior", sourceRuleId: "other", depth: 5 } }))).toEqual([]);
  });
  it("filters atomic transitions by the expected current state and rejects a mismatch", async () => {
    let filter: unknown;
    const db = { collection: () => ({ findOneAndUpdate: async (value: unknown) => { filter = value; return null; } }) };
    const repository = new AutomationRepository(db as never);
    expect(await repository.transitionExecution("execution-1", "running", "succeeded")).toBeUndefined();
    expect(filter).toEqual({ _id: "execution-1", status: "running" });
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
    ["automation_events", { expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ]);
});
