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
});
