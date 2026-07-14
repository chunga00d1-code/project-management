import { describe, expect, it } from "vitest";
import { taskInput, userInput, ValidationError } from "../src/core/validation.js";
describe("request validation", () => {
  it("accepts UTC scheduling and rejects reversed datetimes", () => {
    expect(taskInput({ title: "Review PR", projectId: "repo-1", repository: "acme/widgets", startAt: "2026-07-14T02:00:00.000Z", dueAt: "2026-07-14T04:00:00.000Z" }, "create")).toMatchObject({ startAt: "2026-07-14T02:00:00.000Z", dueAt: "2026-07-14T04:00:00.000Z" });
    expect(() => taskInput({ title: "Review PR", startAt: "2026-07-14T04:00:00.000Z", dueAt: "2026-07-14T02:00:00.000Z" }, "create")).toThrow("Deadline must be later than start time");
  });
  it("rejects legacy scheduling fields on create", () => {
    expect(() => taskInput({ title: "Review PR", sprint: "S1" }, "create")).toThrow("Unsupported task field");
    expect(() => taskInput({ title: "Review PR", team: "Core" }, "create")).toThrow("Unsupported task field");
  });
  it("rejects immutable and unknown task fields", () => {
    expect(() => taskInput({ title: "x", _id: "forged" }, "create")).toThrow(ValidationError);
  });
  it("requires a strong password and non-privileged role for created users", () => {
    expect(() => userInput({ email: "a@example.com", password: "short", role: "admin" })).toThrow(ValidationError);
    expect(() => userInput({ email: "a@example.com", password: "long-enough-password", role: "superadmin" })).toThrow(ValidationError);
  });
});
