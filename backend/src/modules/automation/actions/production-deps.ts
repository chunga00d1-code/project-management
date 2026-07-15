import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { resolveGithubToken } from "../../github-app/github-token.service.js";
import type { AutomationActionDependencies } from "./register-actions.js";

type StringDocument = { _id: string; [key: string]: unknown };
type Effect = { _id: string; status: "running" | "completed"; result?: Record<string, unknown>; createdAt: string; completedAt?: string };
export class MongoActionEffectStore {
  constructor(private readonly db: Pick<Db, "collection">) {}
  async run<T extends Record<string, unknown>>(key: string, operation: () => Promise<T>): Promise<T> {
    const col = this.db.collection<Effect>("automation_action_effects");
    const prior = await col.findOne({ _id: key });
    if (prior?.status === "completed") return prior.result as T;
    if (prior) throw Object.assign(new Error(`Automation effect is already running: ${key}`), { transient: true });
    try { await col.insertOne({ _id: key, status: "running", createdAt: new Date().toISOString() }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; const winner = await col.findOne({ _id: key }); if (winner?.status === "completed") return winner.result as T; throw Object.assign(new Error(`Automation effect is already running: ${key}`), { transient: true }); }
    try { const result = await operation(); await col.updateOne({ _id: key, status: "running" }, { $set: { status: "completed", result, completedAt: new Date().toISOString() } }); return result; }
    catch (error) { await col.deleteOne({ _id: key, status: "running" }); throw error; }
  }
}

async function github(repository: string, path: string, init: RequestInit = {}) {
  const token = await resolveGithubToken(repository); if (!token) throw new Error(`No GitHub credentials for ${repository}`);
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", ...init.headers } });
  if (!response.ok) throw new Error(`GitHub automation HTTP ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

export function createProductionAutomationActionDependencies(db: Db): AutomationActionDependencies {
  const effects = new MongoActionEffectStore(db); const tasks = db.collection<StringDocument>("github_pr_tasks");
  const run = <T extends Record<string, unknown>>(key: string, fn: () => Promise<T>) => effects.run(key, fn);
  return {
    tasks: {
      create: (input, key) => run(key, async () => { const now = new Date().toISOString(), taskId = randomUUID(); await tasks.insertOne({ _id: taskId, code: `AUTO-${taskId.slice(0, 8)}`, title: input.title, description: input.description ?? "", assignee: "", status: "todo", priority: input.priority ?? "medium", labels: input.labels ?? [], projectId: input.projectId, activities: [], comments: [], checklist: [], dependencies: [], watchers: [], createdAt: now, updatedAt: now, automationCreated: true }); return { taskId, version: now }; }),
      update: (taskId, changes, key) => run(key, async () => { const previous = await tasks.findOne({ _id: taskId }); if (!previous) throw new Error("Task not found"); const version = new Date().toISOString(); const result = await tasks.updateOne({ _id: taskId, updatedAt: previous.updatedAt }, { $set: { ...changes, updatedAt: version } }); if (!result.modifiedCount) throw Object.assign(new Error("Task update conflict"), { code: "conflict" }); const snapshot = Object.fromEntries(Object.keys(changes).map(k => [k, previous[k]])); return { taskId, previous: snapshot, version }; }),
      assign: (taskId, assignee, key) => run(key, async () => { const previous = await tasks.findOne({ _id: taskId }); if (!previous) throw new Error("Task not found"); const version = new Date().toISOString(); const result = await tasks.updateOne({ _id: taskId, updatedAt: previous.updatedAt }, { $set: { assignee, updatedAt: version } }); if (!result.modifiedCount) throw Object.assign(new Error("Task assign conflict"), { code: "conflict" }); return { taskId, previous: { assignee: previous.assignee }, version }; }),
      deleteIfVersion: (taskId, version, key) => run(key, async () => ({ deleted: (await tasks.deleteOne({ _id: taskId, updatedAt: version, automationCreated: true })).deletedCount === 1 })).then(r => Boolean(r.deleted)),
      restoreIfVersion: (taskId, version, snapshot, key) => run(key, async () => ({ restored: (await tasks.updateOne({ _id: taskId, updatedAt: version }, { $set: { ...snapshot, updatedAt: new Date().toISOString() } })).modifiedCount === 1 })).then(r => Boolean(r.restored)),
    },
    github: {
      setReviewers: (repository, number, reviewers, key) => run(key, async () => { const pr = await github(repository, `/pulls/${number}`) as { requested_reviewers?: { login: string }[] }; const previousReviewers = (pr.requested_reviewers ?? []).map(x => x.login); if (previousReviewers.length) await github(repository, `/pulls/${number}/requested_reviewers`, { method: "DELETE", body: JSON.stringify({ reviewers: previousReviewers }) }); if (reviewers.length) await github(repository, `/pulls/${number}/requested_reviewers`, { method: "POST", body: JSON.stringify({ reviewers }) }); return { previousReviewers }; }),
      addComment: (repository, number, body, key) => run(key, async () => { const value = await github(repository, `/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) }) as { id: number }; return { commentId: String(value.id), canDelete: true, canEdit: true }; }),
      deleteComment: (repository, id, key) => run(key, async () => { await github(repository, `/issues/comments/${id}`, { method: "DELETE" }); return { deleted: true }; }).then(() => undefined),
      editComment: (repository, id, body, key) => run(key, async () => { await github(repository, `/issues/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }); return { edited: true }; }).then(() => undefined),
      addCorrection: (repository, number, id, body, key) => run(key, async () => { await github(repository, `/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body: `${body}\n\nOriginal comment: ${id}` }) }); return { corrected: true }; }).then(() => undefined),
    },
    notifications: {
      send: (channel, message, key) => run(key, async () => { const messageId = randomUUID(); await db.collection<StringDocument>("automation_notifications").insertOne({ _id: messageId, channel, message, kind: "message", createdAt: new Date().toISOString() }); return { messageId }; }),
      sendCorrection: (originalMessageId, message, key) => run(key, async () => { await db.collection<StringDocument>("automation_notifications").insertOne({ _id: randomUUID(), originalMessageId, message, kind: "correction", createdAt: new Date().toISOString() }); return { corrected: true }; }).then(() => undefined),
    },
    jobs: { retry: (jobId, key) => run(key, async () => { const original = await db.collection("github_pr_dead_letter_jobs").findOne({ _id: new ObjectId(jobId) }); await db.collection("github_pr_retry_jobs").insertOne({ ...(original ?? {}), _id: undefined, sourceJobId: jobId, attempts: 0, nextRunAt: new Date(), createdAt: new Date() }); return { jobId }; }) },
    alerts: {
      create: (input, key) => run(key, async () => { const alertId = randomUUID(); await db.collection<StringDocument>("automation_operations_alerts").insertOne({ _id: alertId, ...input, status: "open", createdAt: new Date().toISOString() }); return { alertId }; }),
      resolve: (alertId, reason, key) => run(key, async () => { await db.collection<StringDocument>("automation_operations_alerts").updateOne({ _id: alertId }, { $set: { status: "resolved", resolution: reason, resolvedAt: new Date().toISOString() } }); return { resolved: true }; }).then(() => undefined),
    },
  };
}
