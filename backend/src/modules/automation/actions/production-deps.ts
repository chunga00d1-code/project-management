import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { resolveGithubToken } from "../../github-app/github-token.service.js";
import type { AutomationActionDependencies } from "./register-actions.js";

type ReviewerSnapshot = { users: string[]; teams: string[] };
type StringDocument = { _id: string; [key: string]: unknown };
type Effect = {
  _id: string;
  status: "running" | "completed" | "ambiguous";
  owner: string;
  operationId: string;
  leaseUntil: Date;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

type EffectStoreOptions = {
  owner?: string;
  leaseMs?: number;
  now?: () => Date;
  wait?: (milliseconds: number) => Promise<void>;
  waitMs?: number;
  maxWaits?: number;
  heartbeatMs?: number;
  setInterval?: (callback: () => void, milliseconds: number) => ReturnType<typeof setInterval>;
  clearInterval?: (timer: ReturnType<typeof setInterval>) => void;
};

export class MongoActionEffectStore {
  private readonly owner: string;
  private readonly leaseMs: number;
  private readonly now: () => Date;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly waitMs: number;
  private readonly maxWaits: number;
  private readonly heartbeatMs: number;
  private readonly setHeartbeat: NonNullable<EffectStoreOptions["setInterval"]>;
  private readonly clearHeartbeat: NonNullable<EffectStoreOptions["clearInterval"]>;

  constructor(
    private readonly db: Pick<Db, "collection">,
    options: EffectStoreOptions = {},
  ) {
    this.owner = options.owner ?? randomUUID();
    this.leaseMs = options.leaseMs ?? 30_000;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.waitMs = options.waitMs ?? 25;
    this.maxWaits = options.maxWaits ?? 40;
    this.heartbeatMs = options.heartbeatMs ?? Math.max(1, Math.floor(this.leaseMs / 3));
    this.setHeartbeat = options.setInterval ?? ((callback, milliseconds) => setInterval(callback, milliseconds));
    this.clearHeartbeat = options.clearInterval ?? (timer => clearInterval(timer));
  }

  async run<T extends Record<string, unknown>>(
    namespace: string,
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const effectId = `${namespace}:${key}`;
    const operationId = randomUUID();
    const collection = this.db.collection<Effect>("automation_action_effects");
    let waits = 0;

    while (true) {
      const existing = await collection.findOne({ _id: effectId });
      if (existing?.status === "completed") return existing.result as T;
      if (existing?.status === "ambiguous") {
        throw Object.assign(new Error(`Automation effect outcome is ambiguous: ${effectId}`), { code: "ambiguous" });
      }

      const now = this.now();
      const leaseUntil = new Date(now.getTime() + this.leaseMs);
      if (!existing) {
        try {
          await collection.insertOne({
            _id: effectId,
            status: "running",
            owner: this.owner,
            operationId,
            leaseUntil,
            createdAt: now.toISOString(),
          });
          break;
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
        }
      } else if (existing.leaseUntil <= now) {
        const reclaimed = await collection.updateOne(
          { _id: effectId, status: "running", operationId: existing.operationId, leaseUntil: existing.leaseUntil },
          { $set: { owner: this.owner, operationId, leaseUntil } },
        );
        if (reclaimed.matchedCount === 1) break;
      }

      if (waits++ >= this.maxWaits) {
        throw Object.assign(new Error(`Automation effect is still running: ${effectId}`), { transient: true });
      }
      await this.wait(this.waitMs);
    }

    let ownershipLost = false;
    const heartbeat = this.setHeartbeat(() => {
      const leaseUntil = new Date(this.now().getTime() + this.leaseMs);
      void collection.updateOne(
        { _id: effectId, status: "running", operationId },
        { $set: { leaseUntil } },
      ).then(result => {
        if (result.matchedCount !== 1) ownershipLost = true;
      }).catch(() => {
        ownershipLost = true;
      });
    }, this.heartbeatMs);

    try {
      const result = await operation();
      if (ownershipLost) throw Object.assign(new Error(`Lost automation effect lease: ${effectId}`), { code: "ambiguous" });
      const completed = await collection.updateOne(
        { _id: effectId, status: "running", operationId },
        { $set: { status: "completed", result, completedAt: this.now().toISOString() } },
      );
      if (completed.matchedCount !== 1) {
        throw Object.assign(new Error(`Lost automation effect lease: ${effectId}`), { code: "ambiguous" });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let ambiguityPersisted = false;
      try {
        const ambiguity = await collection.updateOne(
          { _id: effectId, status: "running", operationId },
          { $set: { status: "ambiguous", error: message } },
        );
        ambiguityPersisted = ambiguity.matchedCount === 1;
      } catch { /* best-effort; preserve original failure */ }
      try {
        await this.db.collection<StringDocument>("automation_operations_alerts").insertOne({
          _id: randomUUID(),
          type: "automation.effect_ambiguous",
          priority: "high",
          effectId,
          operationId,
          ambiguityPersisted,
          message: `Automation effect requires manual verification: ${message}`,
          status: "open",
          createdAt: this.now().toISOString(),
        });
      } catch { /* best-effort; preserve original failure */ }
      throw error;
    } finally {
      this.clearHeartbeat(heartbeat);
    }
  }
}
function assertGithubRequest(repository: string, path: string): void {
  const parts = repository.split("/");
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(parts[0] ?? "");
  const validRepository = /^[A-Za-z0-9_.-]{1,100}$/.test(parts[1] ?? "") && ![".", ".."].includes(parts[1]);
  if (parts.length !== 2 || !validOwner || !validRepository || !path.startsWith("/")) {
    throw new Error("Invalid GitHub automation target");
  }
}

async function github(repository: string, path: string, init: RequestInit = {}) {
  assertGithubRequest(repository, path);
  const token = await resolveGithubToken(repository); if (!token) throw new Error(`No GitHub credentials for ${repository}`);
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", ...init.headers } });
  if (!response.ok) throw new Error(`GitHub automation HTTP ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

async function readReviewerState(repository: string, number: number): Promise<ReviewerSnapshot> {
  const pullRequest = await github(repository, `/pulls/${number}`) as {
    requested_reviewers?: Array<{ login: string }>;
    requested_teams?: Array<{ slug: string }>;
  };
  return {
    users: (pullRequest.requested_reviewers ?? []).map(item => item.login),
    teams: (pullRequest.requested_teams ?? []).map(item => item.slug),
  };
}

async function mutateReviewerDiff(
  repository: string,
  number: number,
  current: ReviewerSnapshot,
  desired: ReviewerSnapshot,
): Promise<void> {
  const removeUsers = current.users.filter(item => !desired.users.includes(item));
  const removeTeams = current.teams.filter(item => !desired.teams.includes(item));
  const addUsers = desired.users.filter(item => !current.users.includes(item));
  const addTeams = desired.teams.filter(item => !current.teams.includes(item));
  if (removeUsers.length || removeTeams.length) {
    await github(repository, `/pulls/${number}/requested_reviewers`, {
      method: "DELETE",
      body: JSON.stringify({ reviewers: removeUsers, team_reviewers: removeTeams }),
    });
  }
  if (addUsers.length || addTeams.length) {
    await github(repository, `/pulls/${number}/requested_reviewers`, {
      method: "POST",
      body: JSON.stringify({ reviewers: addUsers, team_reviewers: addTeams }),
    });
  }
}
export function createProductionAutomationActionDependencies(db: Db): AutomationActionDependencies {
  const effects = new MongoActionEffectStore(db); const tasks = db.collection<StringDocument>("github_pr_tasks");
  const run = <T extends Record<string, unknown>>(namespace: string, key: string, fn: () => Promise<T>) => effects.run(namespace, key, fn);
  return {
    tasks: {
      create: (input, key) => run("task.create", key, async () => { const now = new Date().toISOString(), taskId = randomUUID(); await tasks.insertOne({ _id: taskId, code: `AUTO-${taskId.slice(0, 8)}`, title: input.title, description: input.description ?? "", assignee: "", status: "todo", priority: input.priority ?? "medium", labels: input.labels ?? [], projectId: input.projectId, activities: [], comments: [], checklist: [], dependencies: [], watchers: [], createdAt: now, updatedAt: now, automationCreated: true }); return { taskId, version: now }; }),
      update: (taskId, changes, key) => run("task.update", key, async () => { const previous = await tasks.findOne({ _id: taskId }); if (!previous) throw new Error("Task not found"); const version = new Date().toISOString(); const result = await tasks.updateOne({ _id: taskId, updatedAt: previous.updatedAt }, { $set: { ...changes, updatedAt: version } }); if (!result.modifiedCount) throw Object.assign(new Error("Task update conflict"), { code: "conflict" }); const snapshot = Object.fromEntries(Object.keys(changes).map(k => [k, previous[k]])); return { taskId, previous: snapshot, version }; }),
      assign: (taskId, assignee, key) => run("task.assign", key, async () => { const previous = await tasks.findOne({ _id: taskId }); if (!previous) throw new Error("Task not found"); const version = new Date().toISOString(); const result = await tasks.updateOne({ _id: taskId, updatedAt: previous.updatedAt }, { $set: { assignee, updatedAt: version } }); if (!result.modifiedCount) throw Object.assign(new Error("Task assign conflict"), { code: "conflict" }); return { taskId, previous: { assignee: previous.assignee }, version }; }),
      deleteIfVersion: (taskId, version, key) => run("task.delete", key, async () => ({ deleted: (await tasks.deleteOne({ _id: taskId, updatedAt: version, automationCreated: true })).deletedCount === 1 })).then(r => Boolean(r.deleted)),
      restoreIfVersion: (taskId, version, snapshot, key) => run("task.restore", key, async () => ({ restored: (await tasks.updateOne({ _id: taskId, updatedAt: version }, { $set: { ...snapshot, updatedAt: new Date().toISOString() } })).modifiedCount === 1 })).then(r => Boolean(r.restored)),
    },
    github: {
      applyReviewers: (repository, number, reviewers, teams, key) =>
        run("github.reviewers.apply", key, async () => {
          const snapshots = db.collection<StringDocument>("automation_github_reviewer_snapshots");
          const snapshotId = `github.reviewers.apply:${key}`;
          const current = await readReviewerState(repository, number);
          await snapshots.updateOne(
            { _id: snapshotId },
            { $setOnInsert: { repository, number, previous: current, createdAt: new Date().toISOString() } },
            { upsert: true },
          );
          await mutateReviewerDiff(repository, number, current, { users: reviewers, teams });
          return { previous: current };
        }),
      restoreReviewers: (repository, number, previous, key) =>
        run("github.reviewers.restore", key, async () => {
          const current = await readReviewerState(repository, number);
          await mutateReviewerDiff(repository, number, current, previous);
          return { restored: true };
        }).then(() => undefined),
      addComment: (repository, number, body, key) => run("github.comment.add", key, async () => { const value = await github(repository, `/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) }) as { id: number }; return { commentId: String(value.id), canDelete: true, canEdit: true }; }),
      deleteComment: (repository, id, key) => run("github.comment.delete", key, async () => { await github(repository, `/issues/comments/${id}`, { method: "DELETE" }); return { deleted: true }; }).then(() => undefined),
      editComment: (repository, id, body, key) => run("github.comment.edit", key, async () => { await github(repository, `/issues/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }); return { edited: true }; }).then(() => undefined),
      addCorrection: (repository, number, id, body, key) => run("github.comment.correct", key, async () => { await github(repository, `/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body: `${body}\n\nOriginal comment: ${id}` }) }); return { corrected: true }; }).then(() => undefined),
    },
    notifications: {
      send: (channel, message, key) => run("notification.send", key, async () => { const messageId = randomUUID(); await db.collection<StringDocument>("automation_notifications").insertOne({ _id: messageId, channel, message, kind: "message", createdAt: new Date().toISOString() }); return { messageId }; }),
      sendCorrection: (originalMessageId, message, key) => run("notification.correct", key, async () => { await db.collection<StringDocument>("automation_notifications").insertOne({ _id: randomUUID(), originalMessageId, message, kind: "correction", createdAt: new Date().toISOString() }); return { corrected: true }; }).then(() => undefined),
    },
    jobs: { retry: (jobId, key) => run("job.retry", key, async () => { const original = await db.collection("github_pr_dead_letter_jobs").findOne({ _id: new ObjectId(jobId) }); if (!original) throw new Error("Dead-letter job not found"); await db.collection("github_pr_retry_jobs").insertOne({ ...original, _id: undefined, sourceJobId: jobId, attempts: 0, nextRunAt: new Date(), createdAt: new Date() }); return { jobId }; }) },
    alerts: {
      create: (input, key) => run("operations.alert.create", key, async () => { const alertId = randomUUID(); await db.collection<StringDocument>("automation_operations_alerts").insertOne({ _id: alertId, ...input, status: "open", createdAt: new Date().toISOString() }); return { alertId }; }),
      resolve: (alertId, reason, key) => run("operations.alert.resolve", key, async () => { await db.collection<StringDocument>("automation_operations_alerts").updateOne({ _id: alertId }, { $set: { status: "resolved", resolution: reason, resolvedAt: new Date().toISOString() } }); return { resolved: true }; }).then(() => undefined),
    },
  };
}
