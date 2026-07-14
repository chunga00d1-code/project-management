import { Router } from "express";
import { authenticate, type AuthRequest } from "../../core/auth.js";
import {
  GitHubCollaboratorError,
  listRepositoryCollaborators,
} from "../github-app/collaborator.service.js";
import { ProjectService } from "./project.service.js";

const projects = new ProjectService();
const user = (req: import("express").Request) => (req as AuthRequest).user!;
const admin = (req: import("express").Request) => ["superadmin", "admin"].includes(user(req).role);

export const projectRouter = Router();
projectRouter.use(authenticate);

projectRouter.get("/", async (req, res, next) => {
  try {
    res.json(await projects.list(user(req).email, admin(req)));
  } catch (error) {
    next(error);
  }
});

projectRouter.get("/:id/collaborators", async (req, res, next) => {
  try {
    const project = await projects.get(String(req.params.id), user(req).email, admin(req));
    if (!project) return res.status(404).json({ error: "Repository not found" });
    if (!project.repositoryFullName || !project.installationId) {
      return res.status(400).json({ error: "Repository is not linked to GitHub" });
    }
    res.json(await listRepositoryCollaborators(project.repositoryFullName, project.installationId));
  } catch (error) {
    if (error instanceof GitHubCollaboratorError) {
      return res.status(502).json({ error: "Không thể tải thành viên repository từ GitHub" });
    }
    next(error);
  }
});

projectRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await projects.get(String(req.params.id), user(req).email, admin(req));
    if (!project) return res.status(404).json({ error: "Repository not found" });
    res.json(project);
  } catch (error) {
    next(error);
  }
});
