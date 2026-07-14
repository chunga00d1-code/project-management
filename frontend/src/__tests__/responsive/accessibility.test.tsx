import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ResponsiveDataView } from "../../components/data/ResponsiveDataView";
import { AppShell } from "../../components/layout/AppShell";
import { Overlay } from "../../components/overlay/Overlay";
import { LandingShell } from "../../features/landing/LandingShell";
import { KanbanStatusSwitcher } from "../../features/tasks/KanbanStatusSwitcher";
import { renderAtViewport } from "../../test/renderAtViewport";

const axe = (root: Element) => new Promise<axeCore.AxeResults>((resolve, reject) => {
  axeCore.run(root, { rules: { "color-contrast": { enabled: false } } }, (error, results) => error ? reject(error) : resolve(results));
});

class IntersectionObserverMock { observe() {} disconnect() {} }
beforeAll(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: vi.fn(() => null) });
});
afterEach(cleanup);

describe("responsive accessibility regression", () => {
  it("keeps the open application drawer accessible and keyboard-contained", async () => {
    const user = userEvent.setup();
    renderAtViewport(<AppShell items={[{ id: "tasks", label: "Tasks", icon: "T" }]} activePage="tasks" onNavigate={vi.fn()} user={{ email: "dev@example.com" }} onSignOut={vi.fn()}><main>Content</main></AppShell>, 375);
    const trigger = screen.getByRole("button", { name: "Mở điều hướng" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Điều hướng chính" });
    expect((await axe(document.body)).violations).toEqual([]);
    const close = within(dialog).getByRole("button", { name: "Đóng điều hướng" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
  });

  it("keeps an open overlay accessible with Escape and focus wrapping", async () => {
    const onClose = vi.fn();
    renderAtViewport(<Overlay open title="Create task" onClose={onClose} footer={<button>Save</button>}><label>Name<input /></label></Overlay>, 375);
    const dialog = screen.getByRole("dialog", { name: "Create task" });
    expect((await axe(document.body)).violations).toEqual([]);
    const close = within(dialog).getByRole("button", { name: "Close" });
    const save = within(dialog).getByRole("button", { name: "Save" });
    save.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps status tabs accessible and follows arrow-key focus", async () => {
    const onChange = vi.fn();
    render(<main><KanbanStatusSwitcher compact={false} activeStatus="todo" onChange={onChange} statuses={[{ id: "todo", label: "Todo", count: 2 }, { id: "done", label: "Done", count: 1 }]} /><section id="kanban-panel-todo" role="tabpanel" aria-labelledby="kanban-tab-todo">Todo tasks</section><section id="kanban-panel-done" role="tabpanel" aria-labelledby="kanban-tab-done">Done tasks</section></main>);
    expect((await axe(document.body)).violations).toEqual([]);
    const todo = screen.getByRole("tab", { name: /Todo/ });
    fireEvent.keyDown(todo, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("done");
    expect(screen.getByRole("tab", { name: /Done/ })).toHaveFocus();
  });

  it("keeps mobile data cards accessible with direct term/value pairs", async () => {
    const { container } = renderAtViewport(<main><ResponsiveDataView rows={[{ id: "1", name: "An" }]} rowKey={(row) => row.id} columns={[{ key: "name", header: "Name", render: (row) => row.name }]} empty={<p>Empty</p>} caption="Members" /></main>, 375);
    expect((await axe(document.body)).violations).toEqual([]);
    const field = container.querySelector(".data-card__field")!;
    expect(Array.from(field.children).map((node) => node.tagName)).toEqual(["DT", "DD"]);
  });

  it("keeps the open landing navigation disclosure accessible and Escape-operable", async () => {
    renderAtViewport(<LandingShell locale="en" onLocale={vi.fn()} onLogin={vi.fn()}><main><h1>ReviewGrid</h1></main></LandingShell>, 375);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    expect((await axe(document.body)).violations).toEqual([]);
    within(screen.getByRole("region", { name: "Navigation menu" })).getByRole("link", { name: "Product" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
