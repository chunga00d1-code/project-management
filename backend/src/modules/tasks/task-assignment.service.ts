import { ValidationError } from "../../core/validation.js";
import type { GitHubCollaborator } from "../github-app/collaborator.service.js";
import type { Project, ProjectService } from "../projects/project.service.js";
import type { RuntimeSettings } from "../settings/settings.service.js";
import type { UserService } from "../users/user.service.js";
import { notifyTaskAssignment } from "../notifications/notification.service.js";
import type { TaskModel } from "./task.model.js";

type AssignmentDependencies = {
  findProject: (id: string) => Promise<Project | null>;
  listCollaborators: (repositoryFullName: string, installationId: number) => Promise<GitHubCollaborator[]>;
};

export async function assertRepositoryAssignment(
  input: Partial<TaskModel>,
  dependencies: AssignmentDependencies,
): Promise<Partial<TaskModel>> {
  if (!input.projectId) throw new ValidationError("Repository is required");
  const project = await dependencies.findProject(input.projectId);
  if (!project) throw new ValidationError("Repository not found");
  if (!project.repositoryFullName || !project.installationId) throw new ValidationError("Repository is not linked to GitHub");

  if (input.assignee) {
    const collaborators = await dependencies.listCollaborators(project.repositoryFullName, project.installationId);
    if (!collaborators.some((item) => item.login.toLowerCase() === input.assignee!.toLowerCase())) {
      throw new ValidationError("Assignee is not a repository collaborator");
    }
  }

  return {
    ...input,
    projectId: project._id,
    project: project.name,
    repository: project.repositoryFullName,
  };
}

export function resolveAssigneeEmail(login: string, mappings?: string): string | null {
  if (!login || !mappings) return null;
  const pair = String(mappings)
    .split("\n")
    .map((line) => line.split("=").map((part) => part.trim()))
    .find(([githubLogin]) => githubLogin?.toLowerCase() === login.toLowerCase());
  return pair?.[1] || null;
}

export async function provisionAssignee(
  task: TaskModel,
  settings: RuntimeSettings,
  deps: { users: UserService; projects: ProjectService },
): Promise<void> {
  if (!task.assignee) return;
  const email = resolveAssigneeEmail(task.assignee, settings.githubAssigneeMappings);
  if (!email) return;
  await deps.users.findOrCreateByEmail(email);
  if (task.projectId) await deps.projects.addMember(task.projectId, email);
  await notifyTaskAssignment(task, email, settings);
}
