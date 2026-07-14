import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public product landing", () => {
  it("routes signed-out visitors through the landing page before login", async () => {
    const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).toContain("<LocalizedLandingPage onLogin");
    expect(app).not.toContain("if (!loggedIn) return <Login");
  });

  it("presents the GitHub PR workflow and conversion sections", async () => {
    const source = await readFile(new URL("../features/landing/LandingPage.tsx", import.meta.url), "utf8");
    for (const section of ["landing-hero", "landing-workflow", "landing-capabilities", "landing-security", "landing-pricing", "landing-faq", "landing-final-cta"]) {
      expect(source).toContain(`id="${section}"`);
    }
    expect(source).toContain("GitHub Pull Request");
    expect(source).toContain("Start reviewing");
  });

  it("uses the selected React Bits components", async () => {
    const source = await readFile(new URL("../features/landing/LandingPage.tsx", import.meta.url), "utf8");
    for (const component of ["AnimatedContent", "SpotlightCard", "CountUp", "ShinyText", "StarBorder"]) {
      expect(source).toContain(`<${component}`);
    }
  });
});
