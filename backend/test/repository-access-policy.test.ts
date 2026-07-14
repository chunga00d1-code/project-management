import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("repository-only access policy", () => {
  it("does not depend on removed manual project memberships", async () => {
    const projectService = await readFile(new URL("../src/modules/projects/project.service.ts", import.meta.url), "utf8");
    const taskRouter = await readFile(new URL("../src/modules/tasks/task.router.ts", import.meta.url), "utf8");
    const taskController = await readFile(new URL("../src/modules/tasks/task.controller.ts", import.meta.url), "utf8");

    expect(projectService).toContain("repositoryFullName");
    expect(projectService).not.toContain('"members.email": email');
    expect(taskRouter).not.toContain("memberRole");
    expect(taskRouter).toContain('authorize("superadmin", "admin", "manager")');
    expect(taskController).not.toContain("projects.list(auth(req).email, false)");
  });
});
