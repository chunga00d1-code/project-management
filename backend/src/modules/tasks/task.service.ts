import { randomUUID } from "crypto";
import { database } from "../../core/database.js";
import type { TaskModel } from "./task.model.js";
export class TaskService {
  private async col() { return (await database()).collection<TaskModel>("github_pr_tasks"); }
  async list() { return (await this.col()).find().sort({ updatedAt: -1 }).toArray(); }
  async find(id: string) { return (await this.col()).findOne({ _id: id }); }
  async search(input: { q?: string; status?: string; priority?: string; project?: string; assignee?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    for (const key of ["status", "priority", "project", "assignee"] as const) if (input[key]) filter[key] = input[key];
    if (input.q) filter.$or = [{ title: { $regex: input.q, $options: "i" } }, { description: { $regex: input.q, $options: "i" } }];
    const col = await this.col(); const [items, total] = await Promise.all([col.find(filter).sort({ updatedAt: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).toArray(), col.countDocuments(filter)]);
    return { items, total, page: input.page, pages: Math.ceil(total / input.limit) };
  }
  async dashboard() { const tasks = await this.list(); const active = tasks.filter((t) => !["done", "cancelled"].includes(t.status)); return { total: tasks.length, active: active.length, needsChanges: tasks.filter((t) => t.status === "needs_changes").length, overdue: active.filter((t) => Boolean(t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10))).length, byRepository: Object.entries(tasks.reduce<Record<string, number>>((all, t) => { const key = t.repository || "unlinked"; all[key] = (all[key] || 0) + 1; return all; }, {})).map(([repository, count]) => ({ repository, count })), byProject: Object.entries(tasks.reduce<Record<string, number>>((all, t) => { const key = t.project || "unassigned"; all[key] = (all[key] || 0) + 1; return all; }, {})).map(([project, count]) => ({ project, count })), byAssignee: Object.entries(active.reduce<Record<string, number>>((all, t) => { const key = t.assignee || "unassigned"; all[key] = (all[key] || 0) + 1; return all; }, {})).map(([assignee, count]) => ({ assignee, count })) }; }
  async create(input: Partial<TaskModel>) { const now = new Date().toISOString(); const task: TaskModel = { _id: randomUUID(), title: input.title || "Untitled", description: input.description || "", assignee: input.assignee || "", status: input.status || "todo", priority: input.priority || "medium", dueDate: input.dueDate, labels: input.labels || [], project: input.project, projectId: input.projectId, sprint: input.sprint, team: input.team, repository: input.repository, pullRequestNumber: input.pullRequestNumber, activities: [{ id: randomUUID(), message: "Task created", at: now }], comments: [], checklist: [], dependencies: input.dependencies || [], watchers: input.watchers || [], createdAt: now, updatedAt: now }; await (await this.col()).insertOne(task); return task; }
  async update(id: string, input: Partial<TaskModel>) { const col = await this.col(); const current = await col.findOne({ _id: id }); if (!current) return null; const now = new Date().toISOString(); const status = input.status && input.status !== current.status ? { activities: [{ id: randomUUID(), message: `Status changed: ${current.status} → ${input.status}`, at: now }, ...current.activities] } : {}; await col.updateOne({ _id: id }, { $set: { ...input, ...status, updatedAt: now } }); return col.findOne({ _id: id }); }
  async remove(id: string) { return (await (await this.col()).deleteOne({ _id: id })).deletedCount === 1; }
  async addComment(id: string, text: string, author: string) { const comment = { id: randomUUID(), text, author, at: new Date().toISOString() }; const result = await (await this.col()).updateOne({ _id: id }, { $push: { comments: { $each: [comment], $position: 0 } }, $set: { updatedAt: comment.at } }); return result.matchedCount ? comment : null; }
  async completionBlockers(id: string) { const task = await this.find(id); if (!task) return null; const incompleteChecklist = (task.checklist || []).filter((item) => !item.done); const dependencies = task.dependencies || []; const dependencyTasks = dependencies.length ? await (await this.col()).find({ _id: { $in: dependencies } }).toArray() : []; const byId = new Map(dependencyTasks.map((item) => [item._id, item])); const blockingDependencies = dependencies.filter((dependencyId) => byId.get(dependencyId)?.status !== "done"); return { incompleteChecklist, blockingDependencies }; }  async addChecklistItem(id: string, text: string) { const item = { id: randomUUID(), text, done: false, createdAt: new Date().toISOString() }; const result = await (await this.col()).updateOne({ _id: id }, { $push: { checklist: item }, $set: { updatedAt: item.createdAt } }); return result.matchedCount ? item : null; }
  async setChecklistItem(id: string, itemId: string, done: boolean) { const now = new Date().toISOString(); const result = await (await this.col()).updateOne({ _id: id, "checklist.id": itemId }, { $set: { "checklist.$.done": done, updatedAt: now } }); return result.matchedCount > 0; }
  async setRelations(id: string, input: { dependencies?: string[]; watchers?: string[] }) { const now = new Date().toISOString(); await (await this.col()).updateOne({ _id: id }, { $set: { ...input, updatedAt: now } }); return (await this.col()).findOne({ _id: id }); }  async upsertPullRequest(input: { repository: string; number: number; title: string; url: string; status: TaskModel["status"]; summary: string; assignee?: string; }) {
    const col = await this.col();
    const changes = { title: `Review PR #${input.number}: ${input.title}`, status: input.status, description: input.summary, assignee: input.assignee || "" };
    const existing = await col.findOne({ repository: input.repository, pullRequestNumber: input.number });
    if (existing) return this.update(existing._id, { ...changes, assignee: input.assignee || existing.assignee });
    try { return await this.create({ ...changes, repository: input.repository, pullRequestNumber: input.number, labels: ["github", "pull-request"] }); }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error; const concurrent = await col.findOne({ repository: input.repository, pullRequestNumber: input.number }); if (!concurrent) throw error; return this.update(concurrent._id, { ...changes, assignee: input.assignee || concurrent.assignee }); }
  }
}






