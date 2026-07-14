import { ValidationError } from "../../core/validation.js";
import type { GitHubCollaborator } from "../github-app/collaborator.service.js";
import type { Project } from "../projects/project.service.js";
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
