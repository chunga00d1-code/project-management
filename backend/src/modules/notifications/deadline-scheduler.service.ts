import { database } from "../../core/database.js";
import { logger } from "../../core/logger.js";
import { publishRealtimeEvent } from "../realtime/realtime.service.js";
import type { TaskModel } from "../tasks/task.model.js";
import { SettingsService } from "../settings/settings.service.js";
import { notifyTaskDeadline } from "./deadline-notification.service.js";

const taskDeadline = (task: TaskModel) => task.dueAt || (task.dueDate ? `${task.dueDate}T23:59:59.999Z` : undefined);

export class DeadlineScheduler {
  private timer?: NodeJS.Timeout;
  private running = false;

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowDate = tomorrow.toISOString().slice(0, 10);
      const col = (await database()).collection<TaskModel>("github_pr_tasks");
      const tasks = await col.find({
        $or: [{ dueAt: { $lte: tomorrow.toISOString() } }, { dueDate: { $lte: tomorrowDate } }],
        status: { $nin: ["done", "cancelled"] },
      }).toArray();
      const settings = await new SettingsService().get();

      for (const task of tasks) {
        const dueAt = taskDeadline(task);
        if (!dueAt) continue;
        const dueTime = Date.parse(dueAt);
        const phase = dueTime < now.getTime() ? "overdue" : dueAt.slice(0, 10) === now.toISOString().slice(0, 10) ? "due_today" : "due_tomorrow";
        const key = `${dueAt}:${phase}`;
        if ((task.deadlineNotificationKeys || []).includes(key)) continue;
        const claimed = await col.updateOne(
          { _id: task._id, deadlineNotificationKeys: { $ne: key } },
          { $addToSet: { deadlineNotificationKeys: key } },
        );
        if (!claimed.modifiedCount) continue;
        const recipients = [...(task.watchers || []), ...(task.assignee.includes("@") ? [task.assignee] : [])];
        try {
          await notifyTaskDeadline({ title: task.title, dueDate: dueAt, phase, recipients, settings });
          logger.info("task_deadline_notification_sent", { taskId: task._id, dueAt, phase, recipientCount: recipients.length });
        } catch (error) {
          await col.updateOne({ _id: task._id }, { $pull: { deadlineNotificationKeys: key } });
          logger.error("task_deadline_notification_failed", { taskId: task._id, dueAt, phase, error });
          await publishRealtimeEvent({ type: "notification.failed", projectId: task.projectId, entityId: task._id, payload: { dueAt, phase } });
        }
      }
    } finally {
      this.running = false;
    }
  }

  start() {
    void this.run();
    this.timer = setInterval(() => void this.run(), 15 * 60_000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const deadlineScheduler = new DeadlineScheduler();
