import { Router } from "express";
import { authenticate, authorize } from "../../core/auth.js";
import { audit } from "../../core/audit.service.js";
import { text, ValidationError } from "../../core/validation.js";
import { TaskService } from "./task.service.js";
import { taskController } from "./task.controller.js";

const tasks = new TaskService();
const manage = authorize("superadmin", "admin", "manager");
const participate = authorize("superadmin", "admin", "manager", "developer");

async function taskExists(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  try {
    if (!await tasks.find(String(req.params.id))) return res.status(404).json({ error: "Task not found" });
    next();
  } catch (error) {
    next(error);
  }
}

const strings = (value: unknown, name: string, max = 50) => {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== "string" || !item.trim() || item.length > 254)) throw new ValidationError(`Invalid ${name}`);
  return [...new Set(value.map((item) => item.trim()))];
};

export const taskRouter = Router();
taskRouter.use(authenticate);
taskRouter.get("/dashboard", taskController.dashboard);
taskRouter.get("/search", taskController.search);
taskRouter.get("/", taskController.list);
taskRouter.post("/", authorize("superadmin", "admin", "manager"), taskController.create);
taskRouter.use("/:id", taskExists);
taskRouter.post("/:id/checklist", participate, async (req, res, next) => {
  try {
    const item = await tasks.addChecklistItem(String(req.params.id), text(req.body?.text, "checklist text", 500, true) || "");
    if (!item) return res.status(404).json({ error: "Task not found" });
    await audit({ action: "task.checklist.add", target: String(req.params.id), metadata: { itemId: item.id } });
    res.status(201).json(item);
  } catch (error) { if (error instanceof ValidationError) return res.status(400).json({ error: error.message }); next(error); }
});
taskRouter.patch("/:id/checklist/:itemId", participate, async (req, res, next) => {
  try {
    if (typeof req.body?.done !== "boolean") return res.status(400).json({ error: "Invalid checklist state" });
    if (!await tasks.setChecklistItem(String(req.params.id), String(req.params.itemId), req.body.done)) return res.status(404).json({ error: "Checklist item not found" });
    await audit({ action: "task.checklist.update", target: String(req.params.id), metadata: { itemId: req.params.itemId, done: req.body.done } });
    res.status(204).end();
  } catch (error) { next(error); }
});
taskRouter.put("/:id/relations", manage, async (req, res, next) => {
  try {
    const dependencies = strings(req.body?.dependencies || [], "dependencies", 100);
    if (dependencies.includes(String(req.params.id))) return res.status(400).json({ error: "Task cannot depend on itself" });
    const watchers = strings(req.body?.watchers || [], "watchers");
    if (watchers.some((email) => !/^\S+@\S+\.\S+$/.test(email))) return res.status(400).json({ error: "Invalid watcher email" });
    const task = await tasks.setRelations(String(req.params.id), { dependencies, watchers });
    if (!task) return res.status(404).json({ error: "Task not found" });
    await audit({ action: "task.relations.update", target: task._id });
    res.json(task);
  } catch (error) { if (error instanceof ValidationError) return res.status(400).json({ error: error.message }); next(error); }
});
taskRouter.patch("/:id/status", participate, taskController.updateStatus);
taskRouter.patch("/:id", manage, taskController.update);
taskRouter.delete("/:id", manage, taskController.remove);
taskRouter.post("/:id/comments", participate, taskController.comment);
