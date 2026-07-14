import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("ReviewGrid brand identity", () => {
  it("provides an accessible reusable Signal Beacon logo", async () => {
    const logo = await source("../components/brand/ReviewGridLogo.tsx");

    expect(logo).toContain("export function ReviewGridLogo");
    expect(logo).toContain("ReviewGrid");
    expect(logo).toContain("See risk. Review clearly.");
    expect(logo).toContain("aria-label");
    expect(logo).toContain("reviewgrid-beacon");
  });

  it("ships primary, monochrome, and favicon SVG assets", async () => {
    const paths = [
      "../../public/brand/reviewgrid-mark.svg",
      "../../public/brand/reviewgrid-logo-dark.svg",
      "../../public/brand/reviewgrid-logo-monochrome.svg",
      "../../public/favicon.svg",
    ];

    const assets = await Promise.all(paths.map(source));
    expect(assets.every((asset) => asset.includes("<svg"))).toBe(true);
    expect(assets[0]).toContain("#73F5C8");
    expect(assets[1]).toContain("ReviewGrid");
  });

  it("uses ReviewGrid across every customer-facing surface", async () => {
    const paths = [
      "../App.tsx",
      "../features/auth/Login.tsx",
      "../features/landing/LandingShell.tsx",
      "../features/landing/LandingPage.tsx",
      "../features/landing/VietnameseLandingPage.tsx",
      "../../index.html",
    ];
    const surfaces = await Promise.all(paths.map(source));

    for (const content of surfaces) {
      expect(content).not.toMatch(/Project Flow/i);
    }
    expect(surfaces.join("\n")).toContain("ReviewGrid");
  });
});
