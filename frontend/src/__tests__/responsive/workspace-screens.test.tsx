import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`frontend/src/${path}`, "utf8");

describe("workspace screen structure", () => {
  const pages = [
    "features/overview/Overview.tsx",
    "features/auth/Projects.tsx",
    "features/auth/Users.tsx",
    "features/auth/Operations.tsx",
    "features/auth/Settings.tsx",
  ];

  it.each(pages)("migrates %s to the shared page landmarks", (path) => {
    const source = read(path);
    expect(source).toContain("PageContainer");
    expect(source).toContain("PageHeader");
    expect(source).not.toMatch(/<(main|header)(?:\s|>)/);
  });

  it("uses responsive grids without inline grid templates", () => {
    for (const path of ["features/overview/Overview.tsx", "features/tasks/ServerDashboard.tsx", "features/tasks/TaskDashboard.tsx", "features/auth/Operations.tsx"]) {
      const source = read(path);
      expect(source).toContain("ResponsiveGrid");
      expect(source).not.toContain("gridTemplateColumns");
    }
  });

  it("associates every settings label and exposes semantic feedback", () => {
    const source = read("features/auth/Settings.tsx");
    expect(source.match(/htmlFor=/g)).toHaveLength(8);
    expect(source.match(/<section/g)).toHaveLength(2);
    expect(source).toContain('role={message.includes');
  });

  it("keeps workspace CSS on approved boundaries", () => {
    const css = read("styles/features.css");
    const boundaries = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((match) => Number(match[1]));
    expect(boundaries.every((value) => [479, 767, 1023, 1439].includes(value))).toBe(true);
  });
});
