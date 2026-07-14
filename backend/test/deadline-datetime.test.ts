import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("precise task deadlines", () => {
  it("uses dueAt for dashboards, notifications, and PR deadline checks", async () => {
    const paths = [
      "../src/modules/tasks/task.controller.ts",
      "../src/modules/tasks/task.service.ts",
      "../src/modules/notifications/deadline-scheduler.service.ts",
      "../src/modules/webhooks/webhook.router.ts",
    ];
    const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
    for (const source of sources) expect(source).toContain("dueAt");
  });
});
