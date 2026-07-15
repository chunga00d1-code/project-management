import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Task } from "../types";
import { MobileTaskList, taskStatuses } from "../features/tasks/MobileTaskList";
import { mobileTaskMediaQuery } from "../hooks/useResponsiveViewport";
import { TaskCard } from "../components/TaskCard";
import { TaskDetail } from "../features/tasks/TaskDetail";

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
  it("renders task detail inside the responsive modal overlay", () => {
    const html = renderToStaticMarkup(
      <TaskDetail task={task("detail", "todo", "Detail task")} onClose={() => undefined} onChange={() => undefined} />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("task-detail-sheet");
    expect(html).not.toContain("<dialog");
  });

  it("renders a compact, fully activatable task summary", () => {
    const item = {
      ...task("compact", "todo", "A very long task title that should be clamped by the compact card styles"),
      code: "TASK-42",
      assignee: "Nguyen Van Assignee With A Long Name",
      dueAt: "2030-01-01T08:00:00.000Z",
      repository: "org/repository-that-must-not-appear",
      labels: ["hidden-label"],
      checklist: [{ id: "check-1", text: "Hidden checklist", done: false }],
      prSyncStatus: "mismatched",
      prMismatchReasons: ["Hidden mismatch"],
    } as unknown as Task;
    const html = renderToStaticMarkup(<TaskCard task={item} onOpen={() => undefined} />);

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("TASK-42");
    expect(html).toContain("A very long task title");
    expect(html).toContain("Nguyen Van Assignee With A Long Name");
    expect(html).toContain("2030");
    expect(html).not.toContain("repository-that-must-not-appear");
    expect(html).not.toContain("hidden-label");
    expect(html).not.toContain("Hidden checklist");
    expect(html).not.toContain("Hidden mismatch");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("btn-details");
  });

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
      />,
    );
    expect(html).not.toContain("Hidden task");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">1<");
  });
});
