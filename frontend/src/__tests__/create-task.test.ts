import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("repository-driven task creation", () => {
  it("loads collaborators and submits UTC scheduling fields", async () => {
    const source = await readFile(new URL("../features/tasks/CreateTask.tsx", import.meta.url), "utf8");
    expect(source).toContain("/collaborators");
    expect(source.match(/type="datetime-local"/g)).toHaveLength(2);
    expect(source).toContain("startAt");
    expect(source).toContain("dueAt");
    expect(source).toContain("toISOString()");
    expect(source).toContain('role="listbox"');
    expect(source).toContain("avatarUrl");
    expect(source).not.toContain("setSprint");
    expect(source).not.toContain("setTeam");
    expect(source).not.toContain("dueDate:");
  });
});
