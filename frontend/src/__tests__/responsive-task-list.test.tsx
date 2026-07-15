import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Task } from "../types";
import { MobileTaskList, taskStatuses } from "../features/tasks/MobileTaskList";
import { mobileTaskMediaQuery } from "../hooks/useResponsiveViewport";

const task = (id: string, status: string, title: string) => ({
  _id: id,
  title,
  description: "",
  status,
  priority: "medium",
  comments: [],
  checklist: [],
  labels: [],
} as unknown as Task);

describe("responsive task list foundation", () => {
  it("uses the agreed mobile breakpoint", () => {
    expect(mobileTaskMediaQuery).toBe("(max-width: 767px)");
  });

  it("renders all status groups in order with counts and empty states", () => {
    const html = renderToStaticMarkup(
      <MobileTaskList
        tasks={[task("1", "todo", "First task"), task("2", "done", "Finished task")]}
        collapsed={new Set()}
        onToggle={() => undefined}
        onOpen={() => undefined}
        onDelete={() => undefined}
        onStatus={() => undefined}
      />,
    );
    expect(taskStatuses.map(({ status }) => status)).toEqual(["todo", "in_review", "needs_changes", "ready", "done", "cancelled"]);
    expect(html).toContain("First task");
    expect(html).toContain("Finished task");
    expect(html).toContain("Chưa có nhiệm vụ");
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('draggable="true"');
  });

  it("hides cards in collapsed groups but keeps their count", () => {
    const html = renderToStaticMarkup(
      <MobileTaskList
        tasks={[task("1", "todo", "Hidden task")]}
        collapsed={new Set(["todo"])}
        onToggle={() => undefined}
        onOpen={() => undefined}
        onDelete={() => undefined}
        onStatus={() => undefined}
      />,
    );
    expect(html).not.toContain("Hidden task");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">1<");
  });
});
