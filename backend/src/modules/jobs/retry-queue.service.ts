import type { WithId } from "mongodb";
import { database } from "../../core/database.js";
import { logger } from "../../core/logger.js";
import type { Finding } from "../reviews/review.service.js";
import type { RuntimeSettings } from "../settings/settings.service.js";
export interface RetryJob { type: string; payload: { repository: string; number: number; url: string; findings: Finding[]; settings?: RuntimeSettings }; attempts: number; nextRunAt: Date; createdAt: Date; lockedUntil?: Date; lastError?: string; }
const maxAttempts = 8;
export class RetryQueue {
  private timer?: NodeJS.Timeout;
  private async col() { return (await database()).collection<RetryJob>("github_pr_retry_jobs"); }
  async enqueue(type: string, payload: RetryJob["payload"]) { const result = await (await this.col()).insertOne({ type, payload, attempts: 0, nextRunAt: new Date(), createdAt: new Date() }); logger.info("retry_job_enqueued", { jobId: String(result.insertedId), type, repository: payload.repository, pullRequestNumber: payload.number }); }
  private async claim() { const now = new Date(); return (await this.col()).findOneAndUpdate({ nextRunAt: { $lte: now }, $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }] }, { $set: { lockedUntil: new Date(now.getTime() + 5 * 60_000) } }, { sort: { nextRunAt: 1 }, returnDocument: "after" }); }
  start(handler: (job: WithId<RetryJob>) => Promise<void>) { this.timer = setInterval(async () => { const job = await this.claim(); if (!job) return; const col = await this.col(); const jobMeta = { jobId: String(job._id), type: job.type, repository: job.payload.repository, pullRequestNumber: job.payload.number }; try { logger.debug("retry_job_started", { ...jobMeta, attempts: job.attempts }); await handler(job); await col.deleteOne({ _id: job._id, lockedUntil: job.lockedUntil }); logger.info("retry_job_completed", jobMeta); } catch (error) { const attempts = job.attempts + 1; if (attempts >= maxAttempts) { await (await database()).collection("github_pr_dead_letter_jobs").insertOne({ ...job, attempts, failedAt: new Date(), lastError: String(error) }); await col.deleteOne({ _id: job._id, lockedUntil: job.lockedUntil }); logger.error("retry_job_dead_lettered", { ...jobMeta, attempts, error }); return; } const nextRunAt = new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts)); await col.updateOne({ _id: job._id, lockedUntil: job.lockedUntil }, { $set: { attempts, nextRunAt, lastError: String(error) }, $unset: { lockedUntil: "" } }); logger.warn("retry_job_rescheduled", { ...jobMeta, attempts, nextRunAt, error }); } }, 30000); }
  stop() { if (this.timer) clearInterval(this.timer); }
}
export const retryQueue = new RetryQueue();
