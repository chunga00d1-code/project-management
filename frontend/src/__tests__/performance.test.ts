import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hasPermission } from "../hooks/usePermission";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("assignee performance navigation", () => {
  it("grants performance access to managers and admins but not developers", () => {
    expect(hasPermission("superadmin", "performance")).toBe(true);
    expect(hasPermission("admin", "performance")).toBe(true);
    expect(hasPermission("manager", "performance")).toBe(true);
    expect(hasPermission("developer", "performance")).toBe(false);
  });

  it("filters navigation by each declared permission and renders the performance page", async () => {
    const app = await source("../App.tsx");
    expect(app).toContain("hasPermission(user.role, item.permission)");
    expect(app).toContain('page === "performance" && hasPermission(user.role, "performance") ? <Performance />');
  });

  it("registers the protected performance API before the task id routes", async () => {
    const router = await source("../../../backend/src/modules/tasks/task.router.ts");
    const performance = router.indexOf('taskRouter.get("/performance", manage, taskController.performance)');
    const search = router.indexOf('taskRouter.get("/search"');
    expect(performance).toBeGreaterThan(-1);
    expect(search).toBeGreaterThan(performance);
  });
});
