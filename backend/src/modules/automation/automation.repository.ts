import { randomUUID } from "node:crypto";
import type { ClientSession, Db, Filter } from "mongodb";
import type { AutomationEvent, AutomationExecution, AutomationRule, ExecutionStatus } from "./automation.model.js";
import type { AutomationStore } from "./automation.service.js";

type VersionDocument = Omit<AutomationRule, "_id"> & { _id: string; ruleId: string };
type RuleDocument = {
  _id: string;
  draft: AutomationRule;
  activeVersion?: number;
  currentVersionId?: string;
  enabled?: boolean;
  priority?: number;
  trigger?: AutomationRule["trigger"];
  scope?: AutomationRule["scope"];
  effectiveFrom?: string;
  effectiveUntil?: string;
};
export type AutomationTransaction = <T>(work: (session: ClientSession) => Promise<T>) => Promise<T>;

export class AutomationRepository implements AutomationStore {
  private readonly transaction: AutomationTransaction;

  constructor(private readonly db: Db, transaction?: AutomationTransaction) {
    this.transaction = transaction ?? (async <T>(work: (session: ClientSession) => Promise<T>) => {
      const session = this.db.client.startSession();
      let result: T | undefined;
      try {
        await session.withTransaction(async () => { result = await work(session); });
        if (result === undefined) throw new Error("Automation publication transaction produced no result");
        return result;
      } finally { await session.endSession(); }
    });
  }

  async saveDraft(rule: AutomationRule): Promise<AutomationRule> {
    await this.db.collection<RuleDocument>("automation_rules").updateOne({ _id: rule._id }, { $set: { draft: rule } }, { upsert: true });
    return rule;
  }

  publish(ruleId: string, publishedAt: string): Promise<AutomationRule> {
    return this.transaction(async (session) => {
      const rules = this.db.collection<RuleDocument>("automation_rules");
      const current = await rules.findOne({ _id: ruleId }, { session });
      if (!current?.draft) throw new Error("Rule not found");
      const priorVersion = current.activeVersion;
      const version = (priorVersion ?? 0) + 1;
      const snapshot: AutomationRule = { ...current.draft, _id: ruleId, version, versionId: randomUUID(), publishedAt };
      await this.db.collection<VersionDocument>("automation_rule_versions").insertOne({ ...snapshot, _id: snapshot.versionId, ruleId }, { session });
      const previous = priorVersion === undefined ? { $exists: false as const } : priorVersion;
      const advanced = await rules.updateOne({ _id: ruleId, activeVersion: previous }, { $set: {
        activeVersion: version, currentVersionId: snapshot.versionId, enabled: snapshot.enabled,
        priority: snapshot.priority, trigger: snapshot.trigger, scope: snapshot.scope,
        ...(snapshot.effectiveFrom === undefined ? {} : { effectiveFrom: snapshot.effectiveFrom }),
        ...(snapshot.effectiveUntil === undefined ? {} : { effectiveUntil: snapshot.effectiveUntil }),
      }, $unset: {
        ...(snapshot.effectiveFrom === undefined ? { effectiveFrom: "" } : {}),
        ...(snapshot.effectiveUntil === undefined ? { effectiveUntil: "" } : {}),
      } }, { session });
      if (advanced.matchedCount !== 1) throw new Error("Automation rule concurrent publication conflict");
      return snapshot;
    });
  }

  async findRule(ruleId: string) {
    return (await this.db.collection<RuleDocument>("automation_rules").findOne({ _id: ruleId }))?.draft;
  }
  async setEnabled(ruleId: string, enabled: boolean) {
    const updated = await this.db.collection<RuleDocument>("automation_rules").findOneAndUpdate(
      { _id: ruleId, currentVersionId: { $exists: true } }, { $set: { enabled } }, { returnDocument: "after" },
    );
    return updated?.draft ? { ...updated.draft, enabled } : undefined;
  }
  async findMatchingEnabledVersions(event: AutomationEvent): Promise<AutomationRule[]> {
    const pointers = await this.db.collection<RuleDocument>("automation_rules").find({
      enabled: true, "trigger.type": event.type,
      $and: [{ $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: { $lte: event.occurredAt } }] }, { $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: { $gte: event.occurredAt } }] }],
    }).sort({ priority: -1 }).toArray();
    const ids = pointers.map((rule) => rule.currentVersionId).filter((id): id is string => Boolean(id));
    if (!ids.length) return [];
    const documents = await this.db.collection<VersionDocument>("automation_rule_versions").find({ versionId: { $in: ids } }).toArray();
    const versions = documents.map(({ ruleId, ...version }) => ({ ...version, _id: ruleId }));
    const byId = new Map(versions.map((version) => [version.versionId, version]));
    return pointers.map((rule) => rule.currentVersionId && byId.get(rule.currentVersionId)).filter((rule): rule is AutomationRule => Boolean(rule));
  }
  async persistEvent(event: AutomationEvent) {
    const expiresAt = new Date(Date.parse(event.occurredAt) + 30 * 24 * 60 * 60 * 1000);
    try { await this.db.collection("automation_events").insertOne({ ...event, expiresAt }); return { event, inserted: true }; }
    catch (error) { if (!isDuplicate(error)) throw error; const existing = await this.db.collection<AutomationEvent>("automation_events").findOne({ eventId: event.eventId }); return { event: existing ?? event, inserted: false }; }
  }
  async insertExecution(execution: AutomationExecution) {
    try { await this.db.collection<AutomationExecution>("automation_executions").insertOne(execution); return execution; }
    catch (error) { if (!isDuplicate(error)) throw error; const existing = await this.db.collection<AutomationExecution>("automation_executions").findOne({ eventId: execution.eventId, ruleVersionId: execution.ruleVersionId }); if (!existing) throw error; return existing; }
  }
  async transitionExecution(id: string, expected: ExecutionStatus, next: ExecutionStatus) {
    return (await this.db.collection<AutomationExecution>("automation_executions").findOneAndUpdate(
      { _id: id, status: expected } as Filter<AutomationExecution>, { $set: { status: next, updatedAt: new Date().toISOString() } }, { returnDocument: "after" },
    )) ?? undefined;
  }
}
function isDuplicate(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000; }