import { z } from "zod";
const statusEnum = z.enum(["todo", "in_review", "needs_changes", "ready", "done", "cancelled"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).optional(),
  assignee: z.string().max(200).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  repository: z.string().max(200).optional(),
  pullRequestNumber: z.number().int().positive().optional(),
});
export const updateTaskSchema = createTaskSchema.partial();
export const commentSchema = z.object({ text: z.string().trim().min(1).max(5000) });
