import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanStatusSwitcher } from "../../features/tasks/KanbanStatusSwitcher";
import { renderAtViewport } from "../../test/renderAtViewport";

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
