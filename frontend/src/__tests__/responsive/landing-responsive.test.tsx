import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { Login } from "../../features/auth/Login";
import { CommandField } from "../../features/landing/CommandField";
import { LandingShell } from "../../features/landing/LandingShell";
import { installMatchMedia } from "../../test/renderAtViewport";

vi.mock("../../api/client", () => ({ api: vi.fn() }));

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

const mediaList = (matches: boolean, query: string): MediaQueryList => ({
  matches, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
});


function installViewport(width: number, reducedMotion = false) {
  installMatchMedia(width);
  const viewportMatchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => query === "(prefers-reduced-motion: reduce)"
      ? mediaList(reducedMotion, query)
      : viewportMatchMedia(query),
  });
}
function renderShell(width: number, onLogin = vi.fn()) {
  installMatchMedia(width);
  return {
    onLogin,
    ...render(<LandingShell locale="en" onLocale={vi.fn()} onLogin={onLogin}><main /></LandingShell>),
  };
}

beforeAll(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
  for (const mock of Object.values(canvasContext)) {
    if (typeof mock === "function" && "mockClear" in mock) mock.mockClear();
  }
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("responsive landing navigation", () => {
  it("uses a non-modal disclosed navigation region with reachable language controls at 767px", () => {
    renderShell(767);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(trigger).toHaveAttribute("aria-controls", "landing-navigation-menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "EN" })).toBeVisible();
    expect(screen.getByRole("button", { name: "VI" })).toBeVisible();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Navigation menu" });
    for (const label of ["Product", "Workflow", "Security", "Deployment", "FAQ"]) {
      expect(within(region).getByRole("link", { name: label })).toBeVisible();
    }
    expect(within(region).getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  it("keeps desktop controls collapsed at the 768px side of the boundary", () => {
    renderShell(768);
    expect(window.matchMedia("(max-width: 767px)").matches).toBe(false);
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeVisible();
    expect(screen.getByRole("button", { name: "VI" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
  it("closes after section selection", () => {
    renderShell(767);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("link", { name: "Workflow" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and restores focus to the trigger", () => {
    renderShell(767);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    fireEvent.click(trigger);
    screen.getByRole("link", { name: "Product" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes before invoking mobile Sign in", () => {
    const onLogin = vi.fn();
    renderShell(767, onLogin);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);

    fireEvent.click(within(screen.getByRole("region", { name: "Navigation menu" })).getByRole("button", { name: "Sign in" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it("defines the exact 767px compact and 768px desktop CSS boundary", async () => {
    const css = await readFile("frontend/src/features/landing/landing-experience.css", "utf8");
    const landingCss = await readFile("frontend/src/features/landing/landing.css", "utf8");
    const normalized = css.replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll(" ", "");
    expect(normalized).toContain("@media(max-width:767px){");
    expect(normalized).toContain(".pf-menu{display:none");
    expect(normalized).toContain(".pf-mobile-signin{display:none");
    expect(normalized).toContain(".pf-menu{display:block");
    expect(normalized).toContain(".pf-signin{display:none");
    expect(normalized).not.toContain("max-width:800px");
    expect(normalized).not.toContain("max-width:768px");
    const normalizedLanding = landingCss.replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll(" ", "");
    for (const boundary of [1023, 767, 479]) {
      expect(normalizedLanding.split("@media(max-width:" + boundary + "px){")).toHaveLength(2);
    }
    for (const boundary of [767, 479]) {
      expect(normalized.split("@media(max-width:" + boundary + "px){")).toHaveLength(2);
    }
  });
});

describe("CommandField device and motion behavior", () => {
  it("renders one static frame without animation or pointer tracking for reduced motion", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => mediaList(query === "(prefers-reduced-motion: reduce)", query)),
    });
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<CommandField />);

    expect(raf).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
    expect(canvasContext.arc).toHaveBeenCalledTimes(18);
  });

  it("starts and cleans up animation and pointer tracking in normal mode", () => {
    installViewport(768);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(41);
    const cancelRaf = vi.spyOn(window, "cancelAnimationFrame");
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<CommandField />);
    expect(raf).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });

    unmount();

    expect(cancelRaf).toHaveBeenCalledWith(41);
    expect(removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
  });

  it("caps canvas DPR at 2", () => {
    installViewport(768);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    render(<CommandField />);

    expect(canvasContext.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it.each([[479, 32], [480, 62]])("uses initial viewport density at %ipx", (width, particles) => {
    installViewport(width);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    render(<CommandField />);

    expect(canvasContext.arc).toHaveBeenCalledTimes(particles);
  });
});

describe("responsive login", () => {
  it("keeps the compact form fluid with safe-area and dynamic viewport CSS", async () => {
    installViewport(320);
    const { container } = render(<Login onLogin={vi.fn()} />);
    const css = await readFile("frontend/src/styles/features.css", "utf8");

    expect(container.querySelector("main.page-container.login-page")).toBeInTheDocument();
    expect(container.querySelector("form.login-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
    const normalized = css.replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll(" ", "");
    expect(normalized).toContain("form.login-card{width:min(100%,420px);");
    expect(normalized).not.toContain("form.login-card{width:420px;");
    expect(normalized).toContain(".login-page{display:grid;min-height:100dvh;");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("preserves successful authentication storage and callback behavior", async () => {
    vi.mocked(api).mockResolvedValue({ token: "token-1", user: { id: "u1", email: "dev@example.com", role: "developer" } });
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText("Tên đăng nhập (Email)"), { target: { value: "dev@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/Mật khẩu/), { target: { value: "long-password" } });

    fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!);

    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "dev@example.com", password: "long-password" }),
    });
    expect(localStorage.getItem("token")).toBe("token-1");
    expect(JSON.parse(localStorage.getItem("user")!)).toEqual({ id: "u1", email: "dev@example.com", role: "developer" });
  });

  it("preserves rejected authentication error behavior", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Invalid credentials"));
    render(<Login onLogin={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Tên đăng nhập (Email)"), { target: { value: "dev@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/Mật khẩu/), { target: { value: "long-password" } });

    fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!);

    expect(await screen.findByText("Invalid credentials")).toBeVisible();
  });
});
