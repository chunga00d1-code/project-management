import type { Request, Response, NextFunction } from "express";
import { TaskService } from "./task.service.js";
import type { AuthRequest } from "../../core/auth.js";
const tasks = new TaskService();
export const taskController = {
  dashboard: async (_req: Request,res: Response,next: NextFunction)=>{try{res.json(await tasks.dashboard())}catch(error){next(error)}},
  list: async (_req: Request, res: Response, next: NextFunction) => { try { res.json(await tasks.list()); } catch (error) { next(error); } },
  create: async (req: Request, res: Response, next: NextFunction) => { try { res.status(201).json(await tasks.create(req.body)); } catch (error) { next(error); } },
  update: async (req: Request, res: Response, next: NextFunction) => { try { const task = await tasks.update(String(req.params.id), req.body); if (!task) return res.status(404).json({ error: "Task not found" }); return res.json(task); } catch (error) { return next(error); } },
  remove: async (req: Request, res: Response, next: NextFunction) => { try { if(!await tasks.remove(String(req.params.id))) return res.status(404).json({ error: "Task not found" }); return res.status(204).end(); } catch (error) { return next(error); } },
  comment: async (req: Request, res: Response, next: NextFunction) => { try { const comment = await tasks.addComment(String(req.params.id), String(req.body.text || ""), (req as AuthRequest).user?.email || "system"); if (!comment) return res.status(404).json({ error: "Task not found" }); return res.status(201).json(comment); } catch (error) { return next(error); } }
};
