import { Router } from "express";
import { authenticate, authorize } from "../../core/auth.js";
import { taskController } from "./task.controller.js";
export const taskRouter = Router();
taskRouter.use(authenticate);
taskRouter.get("/dashboard", taskController.dashboard);
taskRouter.get("/", taskController.list);
taskRouter.post(
  "/",
  authorize("superadmin", "admin", "manager"),
  taskController.create,
);
taskRouter.patch(
  "/:id",
  authorize("superadmin", "admin", "manager", "developer"),
  taskController.update,
);
taskRouter.delete(
  "/:id",
  authorize("superadmin", "admin", "manager"),
  taskController.remove,
);
taskRouter.post(
  "/:id/comments",
  authorize("superadmin", "admin", "manager", "developer"),
  taskController.comment,
);
