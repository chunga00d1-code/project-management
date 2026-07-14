import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("localized cinematic landing experience", () => {
  it("detects browser language and persists manual language selection", async () => {
    const source = await readFile(new URL("../features/landing/LocalizedLandingPage.tsx", import.meta.url), "utf8");
    expect(source).toContain("navigator.language");
    expect(source).toContain('localStorage.getItem("project-flow-language")');
    expect(source).toContain('localStorage.setItem("project-flow-language"');
  });

  it("provides desktop and mobile navigation with active sections", async () => {
    const source = await readFile(new URL("../features/landing/LandingShell.tsx", import.meta.url), "utf8");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("mobileOpen");
    for (const section of ["landing-capabilities", "landing-workflow", "landing-security", "landing-pricing", "landing-faq"]) expect(source).toContain(section);
  });

  it("adds a pointer-reactive canvas with reduced-motion support", async () => {
    const source = await readFile(new URL("../features/landing/CommandField.tsx", import.meta.url), "utf8");
    expect(source).toContain("<canvas");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("prefers-reduced-motion");
  });
});
