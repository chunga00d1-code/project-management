import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("landing visual layering", () => {
  it("keeps the animated command field visible behind transparent landing content", async () => {
    const css = await readFile(new URL("../features/landing/landing-experience.css", import.meta.url), "utf8");
    expect(css).toContain(".pf-experience>.pf-landing{background:transparent}");
  });

  it("renders the navigation logo text in white", async () => {
    const css = await readFile(new URL("../features/landing/landing-experience.css", import.meta.url), "utf8");
    expect(css).toContain(".pf-premium-nav .pf-logo{color:#fff}");
  });
});
