import { randomUUID } from "crypto";
import { database } from "../../core/database.js";
import type { TaskModel } from "./task.model.js";
export class TaskService {
  private async col() {
    return (await database()).collection<TaskModel>("github_pr_tasks");
  }
  async list() {
    return (await this.col()).find().sort({ updatedAt: -1 }).toArray();
  }
  async dashboard() {
    const tasks = await this.list();
    const active = tasks.filter(
      (t) => !["done", "cancelled"].includes(t.status),
    );
    return {
      total: tasks.length,
      active: active.length,
      needsChanges: tasks.filter((t) => t.status === "needs_changes").length,
      overdue: active.filter((t) =>
        Boolean(t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)),
      ).length,
      byRepository: Object.entries(
        tasks.reduce<Record<string, number>>((all, t) => {
          const key = t.repository || "unlinked";
          all[key] = (all[key] || 0) + 1;
          return all;
        }, {}),
      ).map(([repository, count]) => ({ repository, count })),
    };
  }
  async create(input: Partial<TaskModel>) {
    const now = new Date().toISOString();
    const task: TaskModel = {
      _id: randomUUID(),
      title: input.title || "Untitled",
      description: input.description || "",
      assignee: input.assignee || "",
      status: input.status || "todo",
      priority: input.priority || "medium",
      dueDate: input.dueDate,
      labels: input.labels || [],
      repository: input.repository,
      pullRequestNumber: input.pullRequestNumber,
      activities: [{ id: randomUUID(), message: "Task created", at: now }],
      comments: [],
      createdAt: now,
      updatedAt: now,
    };
    await (await this.col()).insertOne(task);
    return task;
  }
  async update(id: string, input: Partial<TaskModel>) {
    const col = await this.col();
    const current = await col.findOne({ _id: id });
    if (!current) return null;
    const now = new Date().toISOString();
    const status =
      input.status && input.status !== current.status
        ? {
            activities: [
              {
                id: randomUUID(),
                message: `Status changed: ${current.status} ? ${input.status}`,
                at: now,
              },
              ...current.activities,
            ],
          }
        : {};
    await col.updateOne(
      { _id: id },
      { $set: { ...input, ...status, updatedAt: now } },
    );
    return col.findOne({ _id: id });
  }
  async remove(id: string) {
    return (await (await this.col()).deleteOne({ _id: id })).deletedCount === 1;
  }
  async addComment(id: string, text: string, author: string) {
    const comment = {
      id: randomUUID(),
      text,
      author,
      at: new Date().toISOString(),
    };
    const result = await (
      await this.col()
    ).updateOne(
      { _id: id },
      {
        $push: { comments: { $each: [comment], $position: 0 } },
        $set: { updatedAt: comment.at },
      },
    );
    return result.matchedCount ? comment : null;
  }
  async upsertPullRequest(input: {
    repository: string;
    number: number;
    title: string;
    url: string;
    status: TaskModel["status"];
    summary: string;
    assignee?: string;
  }) {
    const col = await this.col();
    const existing = await col.findOne({
      repository: input.repository,
      pullRequestNumber: input.number,
    });
    if (existing)
      return this.update(existing._id, {
        title: `Review PR #${input.number}: ${input.title}`,
        status: input.status,
        description: input.summary,
        assignee: input.assignee || existing.assignee,
      });
    return this.create({
      title: `Review PR #${input.number}: ${input.title}`,
      repository: input.repository,
      pullRequestNumber: input.number,
      status: input.status,
      description: input.summary,
      labels: ["github", "pull-request"],
      assignee: input.assignee || "",
    });
  }
}
