import { database } from "../../core/database.js";
import type { TaskModel } from "./task.model.js";

export interface AssigneePerformance {
  assignee: string;
  totalTasks: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  active: number;
  overdueActive: number;
  mismatchCount: number;
}

function dueTime(task: TaskModel): number | undefined {
  if (task.dueAt) return Date.parse(task.dueAt);
  if (task.dueDate) return Date.parse(`${task.dueDate}T23:59:59.999Z`);
  return undefined;
}

function completedAt(task: TaskModel): number {
  const entry = (task.activities || []).find((item) => item.message.endsWith("→ done"));
  return Date.parse(entry?.at || task.updatedAt);
}

export async function computeAssigneePerformance(): Promise<AssigneePerformance[]> {
  const db = await database();
  const tasks = await db
    .collection<TaskModel>("github_pr_tasks")
    .find({ assignee: { $exists: true, $ne: "" } })
    .toArray();
  const mismatches = await db
    .collection<{ target: string; metadata?: { reasons?: string[] } }>("audit_logs")
    .find({ action: "task.pr.mismatch" })
    .toArray();

  const byCode = new Map(tasks.map((task) => [task.code, task]));
  const stats = new Map<string, AssigneePerformance>();
  const ensure = (assignee: string) => {
    let entry = stats.get(assignee);
    if (!entry) {
      entry = { assignee, totalTasks: 0, completed: 0, completedOnTime: 0, completedLate: 0, active: 0, overdueActive: 0, mismatchCount: 0 };
      stats.set(assignee, entry);
    }
    return entry;
  };

  const now = Date.now();
  for (const task of tasks) {
    const entry = ensure(task.assignee);
    entry.totalTasks += 1;
    if (task.status === "done") {
      entry.completed += 1;
      const due = dueTime(task);
      const finished = completedAt(task);
      if (due !== undefined && !Number.isNaN(finished) && finished > due) entry.completedLate += 1;
      else entry.completedOnTime += 1;
    } else if (task.status !== "cancelled") {
      entry.active += 1;
      const due = dueTime(task);
      if (due !== undefined && due < now) entry.overdueActive += 1;
    }
  }

  for (const record of mismatches) {
    const task = byCode.get(record.target);
    if (!task?.assignee) continue;
    ensure(task.assignee).mismatchCount += 1;
  }

  return [...stats.values()].sort((a, b) => b.totalTasks - a.totalTasks);
}
