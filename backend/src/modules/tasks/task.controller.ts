import type { Request, Response, NextFunction } from "express";
import { TaskService } from "./task.service.js";
import type { AuthRequest } from "../../core/auth.js";
import { createTaskSchema, updateTaskSchema, commentSchema } from "./task.schema.js";
import { logAudit } from "../../core/audit.js";
const tasks = new TaskService();
export const taskController = {
  dashboard: async (_req: Request,res: Response,next: NextFunction)=>{try{res.json(await tasks.dashboard())}catch(error){next(error)}},
  list: async (_req: Request, res: Response, next: NextFunction) => { try { res.json(await tasks.list()); } catch (error) { next(error); } },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      const task = await tasks.create(parsed.data);
      await logAudit((req as AuthRequest).user?.email || "system", "task.create", task._id, { title: task.title });
      res.status(201).json(task);
    } catch (error) { next(error); }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateTaskSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      const task = await tasks.update(String(req.params.id), parsed.data);
      if (!task) return res.status(404).json({ error: "Task not found" });
      await logAudit((req as AuthRequest).user?.email || "system", "task.update", task._id, { fields: Object.keys(parsed.data) });
      return res.json(task);
    } catch (error) { return next(error); }
  },
  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (!await tasks.remove(id)) return res.status(404).json({ error: "Task not found" });
      await logAudit((req as AuthRequest).user?.email || "system", "task.remove", id);
      return res.status(204).end();
    } catch (error) { return next(error); }
  },
  comment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Comment text is required" });
      const actor = (req as AuthRequest).user?.email || "system";
      const comment = await tasks.addComment(String(req.params.id), parsed.data.text, actor);
      if (!comment) return res.status(404).json({ error: "Task not found" });
      await logAudit(actor, "task.comment", String(req.params.id));
      return res.status(201).json(comment);
    } catch (error) { return next(error); }
  }
};
