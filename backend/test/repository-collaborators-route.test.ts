import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("GitHub-managed repository routes", () => {
  it("exposes collaborators and removes manual project mutations", async () => {
    const source = await readFile(new URL("../src/modules/projects/project.router.ts", import.meta.url), "utf8");
    expect(source).toContain('projectRouter.get("/:id/collaborators"');
    expect(source).toContain("listRepositoryCollaborators");
    expect(source).toContain("GitHubCollaboratorError");
    expect(source).not.toContain('projectRouter.post("/"');
    expect(source).not.toContain('projectRouter.patch("/:id"');
    expect(source).not.toContain('projectRouter.put("/:id/members');
  });
});
