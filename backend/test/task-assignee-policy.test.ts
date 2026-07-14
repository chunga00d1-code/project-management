import { describe, expect, it, vi } from "vitest";
import { assertRepositoryAssignment } from "../src/modules/tasks/task-assignment.service.js";

const project = {
  _id: "repo-1",
  name: "widgets",
  description: "",
  members: [],
  repositoryFullName: "acme/widgets",
  installationId: 42,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("repository task assignment", () => {
  it("rejects an assignee outside the selected repository", async () => {
    await expect(assertRepositoryAssignment(
      { projectId: "repo-1", assignee: "outsider" },
      {
        findProject: vi.fn().mockResolvedValue(project),
        listCollaborators: vi.fn().mockResolvedValue([{ login: "alice", avatarUrl: "avatar" }]),
      },
    )).rejects.toThrow("Assignee is not a repository collaborator");
  });

  it("derives repository metadata and permits an unassigned task", async () => {
    const result = await assertRepositoryAssignment(
      { projectId: "repo-1", assignee: "", repository: "forged/repo", project: "forged" },
      {
        findProject: vi.fn().mockResolvedValue(project),
        listCollaborators: vi.fn(),
      },
    );
    expect(result).toMatchObject({ projectId: "repo-1", project: "widgets", repository: "acme/widgets", assignee: "" });
  });
});
