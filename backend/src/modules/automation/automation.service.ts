import { randomUUID } from "node:crypto";
import type { AutomationEvent, AutomationExecution, AutomationRule, ExecutionStatus } from "./automation.model.js";
import type { AutomationRuleInput } from "./automation.validation.js";
import { parseRuleInput } from "./automation.validation.js";
import { matchesConditions } from "./condition-evaluator.js";
import { planExecution } from "./automation-planner.js";

export interface AutomationStore {
  saveDraft(rule: AutomationRule): Promise<AutomationRule>;
  publish(ruleId: string, publishedAt: string): Promise<AutomationRule>;
  findRule(ruleId: string): Promise<AutomationRule | undefined>;
  setEnabled(ruleId: string, enabled: boolean): Promise<AutomationRule | undefined>;
  findMatchingEnabledVersions(event: AutomationEvent): Promise<AutomationRule[]>;
  persistEvent(event: AutomationEvent): Promise<{ event: AutomationEvent; inserted: boolean }>;
  insertExecution(execution: AutomationExecution): Promise<AutomationExecution>;
  transitionExecution(id: string, expected: ExecutionStatus, next: ExecutionStatus): Promise<AutomationExecution | undefined>;
}

type Dependencies = { now?: () => Date; id?: () => string };

function scopeMatches(rule: AutomationRule, event: AutomationEvent): boolean {
  if (rule.scope.type === "system") return true;
  if (rule.scope.type === "repository") return event.scope.repository === rule.scope.id;
  if (rule.scope.type === "project") return event.scope.projectId === rule.scope.id;
  return event.scope.team === rule.scope.id;
}

export class AutomationService {
  private readonly now: () => Date;
  private readonly id: () => string;
  constructor(private readonly store: AutomationStore, dependencies: Dependencies = {}) {
    this.now = dependencies.now ?? (() => new Date()); this.id = dependencies.id ?? randomUUID;
  }
  async createDraft(value: AutomationRuleInput, createdBy: string, ruleId = this.id()): Promise<AutomationRule> {
    const parsed = parseRuleInput(value); const current = await this.store.findRule(ruleId); const now = this.now().toISOString();
    return this.store.saveDraft({ ...parsed, _id: ruleId, versionId: current?.versionId ?? "", version: current?.version ?? 0,
      enabled: parsed.enabled ?? current?.enabled ?? false, priority: parsed.priority ?? 0,
      createdBy: current?.createdBy ?? createdBy, createdAt: current?.createdAt ?? now });
  }
  publish(ruleId: string) { return this.store.publish(ruleId, this.now().toISOString()); }
  setEnabled(ruleId: string, enabled: boolean) { return this.store.setEnabled(ruleId, enabled); }
  async dryRun(ruleOrInput: string | AutomationRuleInput, event: AutomationEvent) {
    const rule = typeof ruleOrInput === "string" ? await this.store.findRule(ruleOrInput) : {
      ...parseRuleInput(ruleOrInput), _id: "dry-run", versionId: "dry-run", version: 0, enabled: false,
      priority: ruleOrInput.priority ?? 0, createdBy: "dry-run", createdAt: this.now().toISOString(),
    } as AutomationRule;
    if (!rule || !scopeMatches(rule, event) || rule.trigger.type !== event.type || !matchesConditions(rule.conditions, event.payload)) return undefined;
    return { rule, plan: await planExecution(rule, event) };
  }
  async ingest(event: AutomationEvent): Promise<AutomationExecution[]> {
    const input = (await this.store.persistEvent(event)).event;
    if ((input.automation?.depth ?? 0) >= 5) return [];
    const results: AutomationExecution[] = [];
    for (const rule of await this.store.findMatchingEnabledVersions(input)) {
      if (input.automation?.sourceRuleId === rule._id || !scopeMatches(rule, input) || !matchesConditions(rule.conditions, input.payload)) continue;
      const plan = await planExecution(rule, input); const now = this.now().toISOString();
      results.push(await this.store.insertExecution({ _id: this.id(), eventId: input.eventId, ruleId: rule._id, ruleVersionId: rule.versionId,
        status: plan.requiresApproval ? "waiting_approval" : "running", event: input, plan, attempts: [], createdAt: now, updatedAt: now }));
    }
    return results;
  }
}
