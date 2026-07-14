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
        <p>Nội dung</p>
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

  it("shows desktop navigation without a hamburger at desktop width", () => {
    renderAtViewport(
      <AppShell
        items={[...items]}
        activePage="overview"
        onNavigate={vi.fn()}
        user={{ email: "a@b.com", role: "admin" }}
        onSignOut={vi.fn()}
      >
        <p>Nội dung</p>
      </AppShell>,
      1024,
    );

    expect(screen.queryByRole("button", { name: "Mở điều hướng" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  });
});
