import { describe, expect, it } from "vitest";
import { taskInput, userInput, ValidationError } from "../src/core/validation.js";
describe("request validation", () => {
  it("accepts a valid task including delivery metadata", () => {
    expect(taskInput({ title: "Implement board", priority: "high", project: "Platform", sprint: "S1", team: "Core", labels: ["ui"] }, "create")).toMatchObject({ title: "Implement board", project: "Platform", sprint: "S1", team: "Core" });
  });
  it("rejects immutable and unknown task fields", () => {
    expect(() => taskInput({ title: "x", _id: "forged" }, "create")).toThrow(ValidationError);
  });
  it("requires a strong password and non-privileged role for created users", () => {
    expect(() => userInput({ email: "a@example.com", password: "short", role: "admin" })).toThrow(ValidationError);
    expect(() => userInput({ email: "a@example.com", password: "long-enough-password", role: "superadmin" })).toThrow(ValidationError);
  });
});
