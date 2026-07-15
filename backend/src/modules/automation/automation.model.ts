export type TriggerType = "pr.opened" | "pr.updated" | "pr.merged" | "pr.closed" | "pr.review_changed" | "task.created" | "task.updated" | "task.status_changed" | "task.due_soon" | "task.overdue" | "integration.failed" | "schedule.tick";
export type ActionType = "task.create" | "task.update" | "task.assign" | "github.assign_reviewer" | "github.comment" | "notification.send" | "job.retry" | "operations.alert";
export type Comparator = "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte" | "exists";

export type ConditionNode =
  | { operator: "and" | "or"; children: ConditionNode[] }
  | { field: string; comparator: Comparator; value?: unknown };

export interface RuleAction {
  id: string;
  type: ActionType;
  config: Record<string, unknown>;
  approvalRequired?: boolean;
  retry: { maxAttempts: number; baseDelayMs: number };
}

export interface AutomationRule {
  _id: string;
  versionId: string;
  version: number;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  scope: { type: "system" | "repository" | "project" | "team"; id?: string };
  trigger: { type: TriggerType };
  conditions: ConditionNode;
  actions: RuleAction[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
}

export interface AutomationEvent {
  eventId: string;
  type: TriggerType;
  source: "audit" | "github" | "scheduler" | "operations";
  occurredAt: string;
  actor?: string;
  scope: { repository?: string; projectId?: string; team?: string };
  payload: Record<string, unknown>;
  automation?: { executionId: string; sourceRuleId: string; depth: number };
}

export type ExecutionStatus = "planned" | "waiting_approval" | "running" | "succeeded" | "rejected" | "cancelled" | "expired" | "compensating" | "rolled_back" | "compensation_failed";

export interface PlannedAction extends RuleAction {
  sensitive: boolean;
  compensationType: string;
  preview: Record<string, unknown>;
}

export interface ExecutionPlan {
  actions: PlannedAction[];
  requiresApproval: boolean;
  inputFingerprint: string;
}

export interface ActionAttempt {
  actionId: string;
  operation?: "execute" | "compensate";
  attempt: number;
  status: "running" | "succeeded" | "failed" | "compensated" | "compensation_failed";
  startedAt: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface AutomationExecution {
  _id: string;
  eventId: string;
  ruleId: string;
  ruleVersionId: string;
  status: ExecutionStatus;
  event: AutomationEvent;
  plan: ExecutionPlan;
  attempts: ActionAttempt[];
  approval?: { decidedBy: string; decidedAt: string; decision: "approved" | "rejected"; inputFingerprint: string };
  lease?: { owner: string; until: Date };
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
}
