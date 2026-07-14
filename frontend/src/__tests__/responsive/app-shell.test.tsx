import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../components/layout/AppShell";
import { renderAtViewport } from "../../test/renderAtViewport";

const items = [
  { id: "overview", label: "Tổng quan", icon: "◈" },
  { id: "tasks", label: "Nhiệm vụ", icon: "◇" },
] as const;
const axe = axeCore.run;
afterEach(cleanup);

describe("AppShell", () => {
  it("opens and closes the mobile drawer and restores focus", async () => {
    const user = userEvent.setup();
    renderAtViewport(
      <AppShell
        items={[...items]}
        activePage="overview"
        onNavigate={vi.fn()}
        user={{ email: "a@b.com", role: "admin" }}
        onSignOut={vi.fn()}
      >
        <main>Nội dung</main>
      </AppShell>,
      375,
    );

    const trigger = screen.getByRole("button", { name: "Mở điều hướng" });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "Điều hướng chính" })).toBeVisible();
    expect((await axe(document.body)).violations).toEqual([]);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Điều hướng chính" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps focus in both directions and recovers focus entering from outside", async () => {
    const user = userEvent.setup();
    renderAtViewport(
      <AppShell items={[...items]} activePage="overview" onNavigate={vi.fn()} user={{ email: "a@b.com" }} onSignOut={vi.fn()}>
        <button>External action</button>
      </AppShell>,
      375,
    );
    const trigger = screen.getByRole("button", { name: "Mở điều hướng" });
    await user.click(trigger);
    const close = document.querySelector<HTMLButtonElement>(".app-drawer__close")!;
    const signOut = screen.getByRole("button", { name: /Đăng xuất/ });

    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(signOut).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    trigger.focus();
    await user.tab();
    expect(close).toHaveFocus();
    trigger.focus();
    await user.tab({ shift: true });
    expect(signOut).toHaveFocus();
  });

  it("closes from a non-focusable backdrop and restores body overflow", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "clip";
    renderAtViewport(
      <AppShell items={[...items]} activePage="overview" onNavigate={vi.fn()} user={{ email: "a@b.com" }} onSignOut={vi.fn()}>
        <main>Nội dung</main>
      </AppShell>,
      375,
    );
    await user.click(screen.getByRole("button", { name: "Mở điều hướng" }));
    expect(document.body.style.overflow).toBe("hidden");
    const backdrop = document.querySelector<HTMLElement>(".app-drawer-backdrop");
    expect(backdrop).not.toBeNull();
    expect(backdrop?.tagName).not.toBe("BUTTON");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).not.toHaveAttribute("tabindex");

    await user.click(backdrop!);
    expect(screen.queryByRole("dialog", { name: "Điều hướng chính" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("clip");
    document.body.style.overflow = "";
  });

  it("exposes the drawer relationship and expanded state on the trigger", async () => {
    const user = userEvent.setup();
    renderAtViewport(
      <AppShell items={[...items]} activePage="overview" onNavigate={vi.fn()} user={{ email: "a@b.com" }} onSignOut={vi.fn()}>
        <main>Nội dung</main>
      </AppShell>,
      375,
    );
    const trigger = screen.getByRole("button", { name: "Mở điều hướng" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "app-navigation-drawer");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Điều hướng chính" })).toHaveAttribute("id", "app-navigation-drawer");
  });

  it("navigates to the selected page and closes the drawer", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderAtViewport(
      <AppShell items={[...items]} activePage="overview" onNavigate={onNavigate} user={{ email: "a@b.com" }} onSignOut={vi.fn()}>
        <main>Nội dung</main>
      </AppShell>,
      375,
    );
    await user.click(screen.getByRole("button", { name: "Mở điều hướng" }));
    await user.click(screen.getByRole("button", { name: "Nhiệm vụ" }));

    expect(onNavigate).toHaveBeenCalledWith("tasks");
    expect(screen.queryByRole("dialog", { name: "Điều hướng chính" })).not.toBeInTheDocument();
  });

  it("shows desktop navigation without a hamburger at desktop width", () => {
    renderAtViewport(
      <AppShell
        items={[...items]}
        activePage="overview"
        onNavigate={vi.fn()}
        user={{ email: "a@b.com", role: "admin" }}
        onSignOut={vi.fn()}
      >
        <main>Nội dung</main>
      </AppShell>,
      1024,
    );

    expect(screen.queryByRole("button", { name: "Mở điều hướng" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  });
});
