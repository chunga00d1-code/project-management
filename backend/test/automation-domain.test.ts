import { describe, expect, it } from "vitest";
import { matchesConditions } from "../src/modules/automation/condition-evaluator.js";
import { parseRuleInput } from "../src/modules/automation/automation.validation.js";

const action = (overrides: Record<string, unknown> = {}) => ({
  id: "notify-owner",
  type: "notification.send",
  config: {},
  retry: { maxAttempts: 3, baseDelayMs: 1000 },
  ...overrides,
});

const rule = (overrides: Record<string, unknown> = {}) => ({
  name: "Notify on urgent work",
  scope: { type: "system" },
  trigger: { type: "task.updated" },
  conditions: { field: "task.priority", comparator: "eq", value: "urgent" },
  actions: [action()],
  ...overrides,
});

describe("automation condition evaluator", () => {
  it("evaluates nested AND/OR conditions and missing dot paths", () => {
    const root = { operator: "and" as const, children: [
      { field: "task.priority", comparator: "eq" as const, value: "high" },
      { operator: "or" as const, children: [
        { field: "task.status", comparator: "eq" as const, value: "blocked" },
        { field: "task.daysOverdue", comparator: "gte" as const, value: 2 },
      ] },
    ] };
    expect(matchesConditions(root, { task: { priority: "high", status: "todo", daysOverdue: 3 } })).toBe(true);
    expect(matchesConditions({ field: "task.owner.email", comparator: "exists", value: false }, { task: {} })).toBe(true);
  });

  it("uses strict equality and inequality", () => {
    expect(matchesConditions({ field: "count", comparator: "eq", value: "2" }, { count: 2 })).toBe(false);
    expect(matchesConditions({ field: "count", comparator: "neq", value: "2" }, { count: 2 })).toBe(true);
  });

  it("supports in and contains for arrays and strings", () => {
    expect(matchesConditions({ field: "state", comparator: "in", value: ["open", "closed"] }, { state: "open" })).toBe(true);
    expect(matchesConditions({ field: "labels", comparator: "contains", value: "urgent" }, { labels: ["urgent"] })).toBe(true);
    expect(matchesConditions({ field: "title", comparator: "contains", value: "fix" }, { title: "urgent fix" })).toBe(true);
  });

  it("supports numeric comparators without coercing invalid operands", () => {
    expect(matchesConditions({ field: "n", comparator: "gt", value: 2 }, { n: 3 })).toBe(true);
    expect(matchesConditions({ field: "n", comparator: "gte", value: 3 }, { n: 3 })).toBe(true);
    expect(matchesConditions({ field: "n", comparator: "lt", value: 4 }, { n: 3 })).toBe(true);
    expect(matchesConditions({ field: "n", comparator: "lte", value: 3 }, { n: 3 })).toBe(true);
    expect(matchesConditions({ field: "missing", comparator: "gte", value: 0 }, {})).toBe(false);
    expect(matchesConditions({ field: "n", comparator: "gt", value: 2 }, { n: "3" })).toBe(false);
  });

  it("treats exists false as undefined and true or omitted as defined", () => {
    expect(matchesConditions({ field: "zero", comparator: "exists" }, { zero: 0 })).toBe(true);
    expect(matchesConditions({ field: "nil", comparator: "exists", value: true }, { nil: null })).toBe(true);
    expect(matchesConditions({ field: "missing", comparator: "exists", value: false }, {})).toBe(true);
  });
});

describe("automation rule validation", () => {
  it("accepts a valid typed rule input", () => {
    expect(parseRuleInput(rule())).toMatchObject({ name: "Notify on urgent work", actions: [{ id: "notify-owner" }] });
  });

  it("rejects invalid triggers and unsupported actions", () => {
    expect(() => parseRuleInput(rule({ trigger: { type: "task.deleted" } }))).toThrow("Invalid automation trigger");
    expect(() => parseRuleInput(rule({ actions: [action({ type: "shell.run" })] }))).toThrow("Unsupported automation action");
  });

  it("validates system and identified scopes", () => {
    expect(() => parseRuleInput(rule({ scope: { type: "system", id: "unexpected" } }))).toThrow("Invalid automation scope");
    for (const type of ["repository", "project", "team"]) {
      expect(() => parseRuleInput(rule({ scope: { type } }))).toThrow("Invalid automation scope");
      expect(parseRuleInput(rule({ scope: { type, id: "scope-1" } })).scope).toEqual({ type, id: "scope-1" });
    }
    expect(() => parseRuleInput(rule({ scope: { type: "organization", id: "x" } }))).toThrow("Invalid automation scope");
  });

  it("requires a name of at most 120 characters", () => {
    expect(() => parseRuleInput(rule({ name: " " }))).toThrow("Invalid name");
    expect(() => parseRuleInput(rule({ name: "x".repeat(121) }))).toThrow("Invalid name");
  });

  it("rejects empty groups and invalid comparator value shapes", () => {
    expect(() => parseRuleInput(rule({ conditions: { operator: "and", children: [] } }))).toThrow("Invalid automation conditions");
    expect(() => parseRuleInput(rule({ conditions: { operator: "or", children: [] } }))).toThrow("Invalid automation conditions");
    expect(() => parseRuleInput(rule({ conditions: { field: "task.status", comparator: "in", value: "open" } }))).toThrow("Invalid automation conditions");
    expect(() => parseRuleInput(rule({ conditions: { field: "task.count", comparator: "gt", value: "2" } }))).toThrow("Invalid automation conditions");
    expect(() => parseRuleInput(rule({ conditions: { field: "task.owner", comparator: "exists", value: "yes" } }))).toThrow("Invalid automation conditions");
  });

  it("limits the total condition nodes to 50", () => {
    const leaf = { field: "task.status", comparator: "eq", value: "todo" };
    expect(parseRuleInput(rule({ conditions: { operator: "and", children: Array.from({ length: 49 }, () => leaf) } }))).toBeDefined();
    expect(() => parseRuleInput(rule({ conditions: { operator: "and", children: Array.from({ length: 50 }, () => leaf) } }))).toThrow("Too many automation condition nodes");
  });

  it("limits actions and requires stable ids, config objects, and retry policies", () => {
    expect(parseRuleInput(rule({ actions: Array.from({ length: 20 }, (_, index) => action({ id: `a-${index}` })) }))).toBeDefined();
    expect(() => parseRuleInput(rule({ actions: Array.from({ length: 21 }, (_, index) => action({ id: `a-${index}` })) }))).toThrow("Too many automation actions");
    expect(() => parseRuleInput(rule({ actions: [action({ id: " " })] }))).toThrow("Invalid automation action id");
    expect(() => parseRuleInput(rule({ actions: [action({ config: [] })] }))).toThrow("Invalid automation action config");
    expect(() => parseRuleInput(rule({ actions: [action({ retry: undefined })] }))).toThrow("Invalid automation retry policy");
  });

  it("enforces retry bounds and integer values", () => {
    for (const maxAttempts of [0, 9, 1.5]) {
      expect(() => parseRuleInput(rule({ actions: [action({ retry: { maxAttempts, baseDelayMs: 1000 } })] }))).toThrow("Invalid automation retry policy");
    }
    for (const baseDelayMs of [999, 3600001, 1000.5]) {
      expect(() => parseRuleInput(rule({ actions: [action({ retry: { maxAttempts: 1, baseDelayMs } })] }))).toThrow("Invalid automation retry policy");
    }
    expect(parseRuleInput(rule({ actions: [action({ retry: { maxAttempts: 8, baseDelayMs: 3600000 } })] }))).toBeDefined();
  });
});
