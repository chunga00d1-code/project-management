import { randomUUID } from "node:crypto";
import type { Db, Filter } from "mongodb";
import type { AutomationEvent, AutomationExecution, AutomationRule, ExecutionStatus } from "./automation.model.js";
import type { AutomationStore } from "./automation.service.js";

type VersionDocument = Omit<AutomationRule, "_id"> & { _id: string; ruleId: string };

export class AutomationRepository implements AutomationStore {
  constructor(private readonly db: Db) {}
  async saveDraft(rule: AutomationRule): Promise<AutomationRule> {
    await this.db.collection<AutomationRule>("automation_rules").updateOne({ _id: rule._id }, { $set: rule }, { upsert: true }); return rule;
  }
  async publish(ruleId: string, publishedAt: string): Promise<AutomationRule> {
    const rules = this.db.collection<AutomationRule & { nextVersion?: number; currentVersionId?: string }>("automation_rules");
    const current = await rules.findOneAndUpdate({ _id: ruleId }, { $inc: { nextVersion: 1 } }, { returnDocument: "after" });
    if (!current) throw new Error("Rule not found");
    const version = current.nextVersion ?? 1; const snapshot: AutomationRule = { ...current, version, versionId: randomUUID(), publishedAt };
    delete (snapshot as AutomationRule & { nextVersion?: number }).nextVersion;
    await this.db.collection<VersionDocument>("automation_rule_versions").insertOne({ ...snapshot, _id: snapshot.versionId, ruleId });
    await rules.updateOne({ _id: ruleId, nextVersion: version }, { $set: { version, versionId: snapshot.versionId, publishedAt, currentVersionId: snapshot.versionId } });
    return snapshot;
  }
  async findRule(ruleId: string) { return (await this.db.collection<AutomationRule>("automation_rules").findOne({ _id: ruleId })) ?? undefined; }
  async setEnabled(ruleId: string, enabled: boolean) {
    return (await this.db.collection<AutomationRule>("automation_rules").findOneAndUpdate({ _id: ruleId }, { $set: { enabled } }, { returnDocument: "after" })) ?? undefined;
  }
  async findMatchingEnabledVersions(event: AutomationEvent): Promise<AutomationRule[]> {
    const pointers = await this.db.collection<AutomationRule & { currentVersionId?: string }>("automation_rules").find({
      enabled: true, "trigger.type": event.type,
      $and: [{ $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: { $lte: event.occurredAt } }] }, { $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: { $gte: event.occurredAt } }] }],
    }).sort({ priority: -1 }).toArray();
    const ids = pointers.map((rule) => rule.currentVersionId ?? rule.versionId).filter(Boolean); if (!ids.length) return [];
    const documents = await this.db.collection<VersionDocument>("automation_rule_versions").find({ versionId: { $in: ids } }).toArray();
    const versions: AutomationRule[] = documents.map(({ ruleId, ...version }) => ({ ...version, _id: ruleId }));
    const byId = new Map(versions.map((version) => [version.versionId, version]));
    return pointers.map((rule) => byId.get(rule.currentVersionId ?? rule.versionId)).filter((rule): rule is AutomationRule => Boolean(rule));
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
