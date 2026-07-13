import { database } from "../../core/database.js";
import { logger } from "../../core/logger.js";
import { publishRealtimeEvent } from "../realtime/realtime.service.js";
import type { TaskModel } from "../tasks/task.model.js";
import { SettingsService } from "../settings/settings.service.js";
import { notifyTaskDeadline } from "./deadline-notification.service.js";
export class DeadlineScheduler {
  private timer?: NodeJS.Timeout; private running = false;
  async run() { if (this.running) return; this.running = true; try { const today = new Date().toISOString().slice(0, 10); const tomorrowDate = new Date(); tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1); const tomorrow = tomorrowDate.toISOString().slice(0, 10); const col = (await database()).collection<TaskModel>("github_pr_tasks"); const tasks = await col.find({ dueDate: { $lte: tomorrow }, status: { $nin: ["done", "cancelled"] } }).toArray(); const settings = await new SettingsService().get(); for (const task of tasks) { if (!task.dueDate) continue; const phase = task.dueDate < today ? "overdue" : task.dueDate === today ? "due_today" : "due_tomorrow"; const key = `${task.dueDate}:${phase}`; if ((task.deadlineNotificationKeys || []).includes(key)) continue; const claimed = await col.updateOne({ _id: task._id, deadlineNotificationKeys: { $ne: key } }, { $addToSet: { deadlineNotificationKeys: key } }); if (!claimed.modifiedCount) continue; const recipients = [...(task.watchers || []), ...(task.assignee.includes("@") ? [task.assignee] : [])]; try { await notifyTaskDeadline({ title: task.title, dueDate: task.dueDate, phase, recipients, settings }); logger.info("task_deadline_notification_sent", { taskId: task._id, dueDate: task.dueDate, phase, recipientCount: recipients.length }); } catch (error) { await col.updateOne({ _id: task._id }, { $pull: { deadlineNotificationKeys: key } }); logger.error("task_deadline_notification_failed", { taskId: task._id, dueDate: task.dueDate, phase, error }); await publishRealtimeEvent({ type: "notification.failed", projectId: task.projectId, entityId: task._id, payload: { dueDate: task.dueDate, phase } }); } } } finally { this.running = false; } }
  start() { void this.run(); this.timer = setInterval(() => void this.run(), 15 * 60_000); }
  stop() { if (this.timer) clearInterval(this.timer); }
}
export const deadlineScheduler = new DeadlineScheduler();

