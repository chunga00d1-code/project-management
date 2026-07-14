import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "../../features/auth/Login";
import { CommandField } from "../../features/landing/CommandField";
import { LandingShell } from "../../features/landing/LandingShell";
import { installMatchMedia } from "../../test/renderAtViewport";

class IntersectionObserverMock {
  observe() {}
  disconnect() {}
}

const canvasContext = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fill: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
};

beforeAll(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("responsive public surfaces", () => {
  it("keeps every navigation destination and Sign in reachable in the compact menu", () => {
    installMatchMedia(320);
    render(<LandingShell locale="en" onLocale={vi.fn()} onLogin={vi.fn()}><main /></LandingShell>);

    const menuButton = screen.getByRole("button", { name: /menu/i });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("dialog", { name: /navigation/i });
    for (const label of ["Product", "Workflow", "Security", "Deployment", "FAQ"]) {
      expect(within(menu).getByRole("link", { name: label })).toBeVisible();
    }
    expect(within(menu).getByRole("button", { name: "Sign in" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("renders a static command field without animation or pointer tracking for reduced motion", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)", media: query, onchange: null,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
      })),
    });
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<CommandField />);

    expect(raf).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
    expect(canvasContext.fillRect).toHaveBeenCalled();
  });

  it("keeps the compact login form fluid and its submit action present", () => {
    installMatchMedia(320);
    const { container } = render(<Login onLogin={vi.fn()} />);

    expect(container.querySelector("main.page-container.login-page")).toBeInTheDocument();
    expect(container.querySelector("form.login-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  });
});
