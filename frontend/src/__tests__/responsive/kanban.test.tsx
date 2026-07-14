import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanStatusSwitcher } from "../../features/tasks/KanbanStatusSwitcher";
import { TaskCard } from "../../components/TaskCard";
import { TaskBoard } from "../../features/tasks/TaskBoard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TaskFilters, type TaskQuery } from "../../features/tasks/TaskFilters";
import type { Task } from "../../types";
import { readFile } from "node:fs/promises";
import { renderAtViewport } from "../../test/renderAtViewport";

const mockApi = vi.hoisted(() => vi.fn());
vi.mock("../../api/client", () => ({ api: mockApi }));
vi.mock("../../features/tasks/TaskDashboard", () => ({ TaskDashboard: () => null }));
vi.mock("../../features/tasks/ServerDashboard", () => ({ ServerDashboard: () => null }));
const statuses = [
  { id: "todo", label: "Cần làm", count: 2 },
  { id: "review", label: "Đang review", count: 0 },
  { id: "done", label: "Hoàn thành", count: 1 },
];

afterEach(cleanup);

describe("mobile Kanban status switcher", () => {
  it("renders selectable counted tabs and supports roving arrow navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAtViewport(<KanbanStatusSwitcher statuses={statuses} activeStatus="todo" onChange={onChange} compact={false} />, 375);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveTextContent("0");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("review");
    await user.keyboard("{ArrowLeft}");
    expect(tabs[0]).toHaveFocus();
  });

  it("renders a labeled select in compact mode and emits the exact status key", () => {
    const onChange = vi.fn();
    renderAtViewport(<KanbanStatusSwitcher statuses={statuses} activeStatus="todo" onChange={onChange} compact />, 375);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "review" } });
    expect(onChange).toHaveBeenCalledWith("review");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});

const task = {
  _id: "task-1", title: "Keyboard task", description: "", assignee: "", status: "todo", priority: "high",
  labels: [], checklist: [], comments: [],
} satisfies Task;

describe("mobile task card action menu", () => {
  it("focuses the menu item and restores the trigger on Escape", async () => {
    const user = userEvent.setup();
    renderAtViewport(<TaskCard task={task} onStatus={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} />, 375);
    const trigger = screen.getByRole("button", { name: "Thêm thao tác" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("menuitem")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("invokes delete, closes the menu and restores the trigger", async () => {
    const user = userEvent.setup(); const onDelete = vi.fn();
    renderAtViewport(<TaskCard task={task} onStatus={vi.fn()} onOpen={vi.fn()} onDelete={onDelete} />, 375);
    const trigger = screen.getByRole("button", { name: "Thêm thao tác" });
    await user.click(trigger); await user.click(screen.getByRole("menuitem"));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
function renderBoard(width: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderAtViewport(<QueryClientProvider client={client}><TaskBoard /></QueryClientProvider>, width);
}

describe("TaskBoard mobile panels", () => {
  it("uses a select-labelled region rather than tabpanel semantics in compact mode", async () => {
    mockApi.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
    renderBoard(375);
    const select = screen.getByRole("combobox", { name: /trạng thái/i });
    const region = await screen.findByRole("region");
    expect(select).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-labelledby", region.querySelector("h2")?.id);
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });

  it("renders one loading panel on mobile and all loading panels on desktop", () => {
    mockApi.mockReturnValue(new Promise(() => {}));
    const mobile = renderBoard(375);
    expect(mobile.container.querySelectorAll(".skeleton-column")).toHaveLength(1);
    cleanup();
    renderBoard(1024);
    expect(document.querySelectorAll(".skeleton-column")).toHaveLength(6);
  });
});
function FilterHarness() {
  const [value, setValue] = useState<TaskQuery>({ q: "needle", priority: "high", project: "" });
  const [open, setOpen] = useState(false);
  return <TaskFilters value={value} onChange={setValue} mobileOpen={open} onMobileOpenChange={setOpen} />;
}

describe("mobile filter sheet", () => {
  it("shows the active count, applies by closing, and clears while remaining open", async () => {
    const user = userEvent.setup(); renderAtViewport(<FilterHarness />, 375);
    const trigger = screen.getByRole("button", { name: /bộ lọc \(2\)/i });
    await user.click(trigger); expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /xóa lọc/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xóa lọc/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /áp dụng/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
function topLevelSelectors(css: string) {
  const selectors: string[] = []; let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index); if (open < 0) break;
    const header = css.slice(index, open).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    let depth = 1; let close = open + 1;
    while (close < css.length && depth) { if (css[close] === "{") depth++; if (css[close] === "}") depth--; close++; }
    if (header && !header.startsWith("@")) selectors.push(...header.split(",").map((item) => item.trim()));
    index = close;
  }
  return selectors;
}

describe("Kanban feature CSS ownership", () => {
  it("has one coherent core base and places mobile overrides after every base rule", async () => {
    const css = await readFile("frontend/src/styles/features.css", "utf8");
    const selectors = topLevelSelectors(css);
    for (const selector of [".filter-bar", ".kanban-grid", ".kanban-column", "article.task-card", ".dashboard-card", ".workload-details"]) {
      expect(selectors.filter((item) => item === selector), selector).toHaveLength(1);
    }
    const mobile = css.lastIndexOf("@media (max-width: 767px)");
    const compact = css.lastIndexOf("@media (max-width: 479px)");
    expect(compact).toBeGreaterThan(mobile);
    expect(css.slice(mobile, compact)).toMatch(/\.filter-bar\s*\{[^}]*position:\s*static[^}]*grid-template-columns:\s*1fr[^}]*background:\s*transparent/s);
    expect(css.slice(mobile, compact)).toMatch(/\.kanban-grid\s*\{[^}]*display:\s*block/s);
    expect(css.slice(mobile, compact)).toMatch(/\.kanban-column\s*\{[^}]*min-height:\s*320px[^}]*max-height:\s*none/s);
  });
});