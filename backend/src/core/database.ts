import { MongoClient, Db, MongoClientOptions } from "mongodb";
import { env } from "../config/env.js";
let client: MongoClient;
export async function database(): Promise<Db> {
  if (!client) {
    const options: MongoClientOptions = { ignoreUndefined: true, ...(env.mongoUser ? { auth: { username: env.mongoUser, password: env.mongoPassword }, authSource: env.mongoAuthSource } : {}) };
    client = new MongoClient(env.mongoUri, options);
    await client.connect();
  }
  return client.db();
}
export async function closeDatabase() { await client?.close(); }
export async function ensureIndexes(providedDb?: Db) {
  const db = providedDb ?? await database();
  const prTasks = db.collection("github_pr_tasks");
  const existingIndexes = await prTasks.listIndexes().toArray().catch(() => []);
  const legacyPrIndex = existingIndexes.find((idx) => idx.name === "repository_1_pullRequestNumber_1" && !idx.partialFilterExpression);
  if (legacyPrIndex) await prTasks.dropIndex(legacyPrIndex.name).catch(() => undefined);
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("auth_sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("auth_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("realtime_events").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("realtime_events").createIndex({ occurredAt: 1 }),
    db.collection("projects").createIndex({ "members.email": 1, updatedAt: -1 }),
    db.collection("projects").createIndex({ repositoryFullName: 1 }, { unique: true, sparse: true }),
    db.collection("github_installations").createIndex({ repositories: 1 }),
    prTasks.createIndex({ repository: 1, pullRequestNumber: 1 }, { unique: true, partialFilterExpression: { pullRequestNumber: { $type: "number" } } }),
    prTasks.createIndex({ code: 1 }, { unique: true, sparse: true }),
    db.collection("github_webhook_deliveries").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("github_pr_retry_jobs").createIndex({ nextRunAt: 1, lockedUntil: 1 }),
    db.collection("github_pr_dead_letter_jobs").createIndex({ failedAt: -1 }),
    db.collection("audit_logs").createIndex({ at: -1 }),
    db.collection("automation_rule_versions").createIndex({ ruleId: 1, version: 1 }, { unique: true }),
    db.collection("automation_rules").createIndex({ enabled: 1, "trigger.type": 1, priority: -1 }),
    db.collection("automation_executions").createIndex({ eventId: 1, ruleVersionId: 1 }, { unique: true }),
    db.collection("automation_executions").createIndex({ status: 1, "lease.until": 1, updatedAt: 1 }),
    db.collection("automation_events").createIndex({ eventId: 1 }, { unique: true }),
    db.collection("automation_events").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
