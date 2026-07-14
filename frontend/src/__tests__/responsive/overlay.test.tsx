import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Overlay } from "../../components/overlay/Overlay";
import { renderAtViewport } from "../../test/renderAtViewport";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Overlay", () => {
  it("renders a mobile sheet with a sticky footer and focuses the requested control", () => {
    const initialFocusRef = createRef<HTMLInputElement>();
    renderAtViewport(
      <Overlay open title="Create task" onClose={vi.fn()} initialFocusRef={initialFocusRef} footer={<button>Save</button>}>
        <input ref={initialFocusRef} aria-label="Title" />
      </Overlay>,
      375,
    );

    const dialog = screen.getByRole("dialog", { name: "Create task" });
    expect(dialog).toHaveClass("overlay--sheet");
    expect(dialog).not.toHaveClass("overlay--modal");
    expect(dialog.querySelector(".overlay__footer")).toHaveClass("action-bar--sticky");
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("renders a desktop modal", () => {
    renderAtViewport(<Overlay open title="Details" onClose={vi.fn()}><p>Body</p></Overlay>, 1024);
    expect(screen.getByRole("dialog", { name: "Details" })).toHaveClass("overlay--modal");
  });

  it("closes on Escape, contains tab focus, and restores prior focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const view = renderAtViewport(
      <Overlay open title="Keyboard dialog" onClose={onClose} footer={<button>Last action</button>}>
        <button>First action</button>
      </Overlay>,
      375,
    );

    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    view.rerender(<Overlay open={false} title="Keyboard dialog" onClose={onClose}><span /></Overlay>);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("keeps the original opener across callback rerenders", async () => {
    const first = vi.fn(); const latest = vi.fn(); const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
    const view = renderAtViewport(<Overlay open title="Stable" onClose={first}><button>Action</button></Overlay>, 375);
    view.rerender(<Overlay open title="Stable" onClose={latest}><button>Action</button></Overlay>);
    await userEvent.setup().keyboard("{Escape}"); expect(latest).toHaveBeenCalledOnce(); expect(first).not.toHaveBeenCalled();
    view.rerender(<Overlay open={false} title="Stable" onClose={latest}><span /></Overlay>); expect(trigger).toHaveFocus(); trigger.remove();
  });

  it("ignores hidden candidates, recovers external focus, and only closes from the backdrop", async () => {
    const user=userEvent.setup(); const close=vi.fn(); renderAtViewport(<Overlay open title="Filter" onClose={close}><input type="hidden" /><button style={{display:"none"}}>Hidden</button><button>Visible</button></Overlay>,375);
    const outside=document.createElement("button");document.body.append(outside);outside.focus();await user.tab();expect(screen.getByRole("button",{name:"Close"})).toHaveFocus();
    await user.click(screen.getByText("Visible"));expect(close).not.toHaveBeenCalled();await user.click(document.querySelector(".overlay-backdrop")!);expect(close).toHaveBeenCalledOnce();outside.remove();
  });

  it("uses modal mode at the exact 768px boundary and renders nothing when closed", () => {
    const view=renderAtViewport(<Overlay open title="Boundary" onClose={vi.fn()}><span /></Overlay>,768);expect(screen.getByRole("dialog")).toHaveClass("overlay--modal");
    view.rerender(<Overlay open={false} title="Boundary" onClose={vi.fn()}><span /></Overlay>);expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
