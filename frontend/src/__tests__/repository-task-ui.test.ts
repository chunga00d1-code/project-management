import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("repository and scheduled task UI", () => {
  it("renders repositories as GitHub-managed without manual mutations", async () => {
    const projects = await source("../features/auth/Projects.tsx");
    expect(projects).toContain("GitHub App");
    expect(projects).not.toContain('method: "POST"');
    expect(projects).not.toContain("members/");
    expect(projects).not.toContain("Tạo dự án");
  });

  it("prefers dueAt and removes sprint and team from task interfaces", async () => {
    const files = await Promise.all([
      "../features/tasks/EditTask.tsx",
      "../components/TaskCard.tsx",
      "../features/tasks/TaskDetail.tsx",
      "../components/TaskMeta.tsx",
    ].map(source));
    const content = files.join("\n");
    expect(content).toContain("dueAt");
    expect(content).toContain("startAt");
    expect(content).toContain("dueDate");
    expect(content).not.toMatch(/task\.sprint|task\.team|value\.sprint|value\.team/);
  });

  it("uses precise deadlines in overview and styles the collaborator listbox", async () => {
    const overview = await source("../features/overview/Overview.tsx");
    const css = await source("../styles/app.css");
    expect(overview).toContain("task.dueAt");
    expect(css).toContain(".assignee-options");
    expect(css).toContain(".field-error");
  });
});
