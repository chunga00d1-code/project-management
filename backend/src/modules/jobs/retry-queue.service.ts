import type { WithId } from "mongodb";
import { database } from "../../core/database.js";
import type { Finding } from "../reviews/review.service.js";
import type { RuntimeSettings } from "../settings/settings.service.js";
export interface RetryJob {
  type: string;
  payload: {
    repository: string;
    number: number;
    url: string;
    findings: Finding[];
    settings?: RuntimeSettings;
  };
  attempts: number;
  nextRunAt: Date;
  createdAt: Date;
  lastError?: string;
}
export class RetryQueue {
  private timer?: NodeJS.Timeout;
  private async col() {
    return (await database()).collection<RetryJob>("github_pr_retry_jobs");
  }
  async enqueue(type: string, payload: RetryJob["payload"]) {
    await (
      await this.col()
    ).insertOne({
      type,
      payload,
      attempts: 0,
      nextRunAt: new Date(),
      createdAt: new Date(),
    });
  }
  start(handler: (job: WithId<RetryJob>) => Promise<void>) {
    this.timer = setInterval(async () => {
      const col = await this.col();
      const job = await col.findOne({ nextRunAt: { $lte: new Date() } });
      if (!job) return;
      try {
        await handler(job);
        await col.deleteOne({ _id: job._id });
      } catch (error) {
        const attempts = job.attempts + 1;
        await col.updateOne(
          { _id: job._id },
          {
            $set: {
              attempts,
              nextRunAt: new Date(
                Date.now() + Math.min(3600000, 30000 * 2 ** attempts),
              ),
              lastError: String(error),
            },
          },
        );
      }
    }, 30000);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const retryQueue = new RetryQueue();
