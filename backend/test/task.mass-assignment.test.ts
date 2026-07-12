import { describe, it, expect } from "vitest";
import { pickWritable } from "../src/modules/tasks/task.service.js";

describe("pickWritable", () => {
  it("keeps only whitelisted task fields", () => {
    const result = pickWritable({ title: "Fix bug", status: "done" } as any);
    expect(result).toEqual({ title: "Fix bug", status: "done" });
  });
  it("strips unknown or dangerous fields such as _id and activities", () => {
    const malicious = { title: "x", _id: "attacker-controlled", activities: [{ id: "1", message: "forged", at: "now" }], createdAt: "forged" } as any;
    const result = pickWritable(malicious);
    expect(result).not.toHaveProperty("_id");
    expect(result).not.toHaveProperty("activities");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).toEqual({ title: "x" });
  });
});
