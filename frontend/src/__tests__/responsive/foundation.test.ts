import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("responsive foundation", () => {
  it("defines the approved viewport, gutter, touch, overflow and motion rules", async () => {
    const css = await readFile(new URL("../../styles/foundation.css", import.meta.url), "utf8");
    expect(css).toContain("--bp-mobile: 480px");
    expect(css).toContain("--bp-tablet: 768px");
    expect(css).toContain("--bp-desktop: 1024px");
    expect(css).toContain("--control-min-height: 44px");
    expect(css).toMatch(/button, input, select, textarea, \[role='button'\]\s*\{[^}]*min-inline-size:\s*var\(--control-min-height\)[^}]*min-block-size:\s*var\(--control-min-height\)/s);
    expect(css).toMatch(/body\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
