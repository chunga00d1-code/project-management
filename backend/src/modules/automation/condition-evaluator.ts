import type { ConditionNode } from "./automation.model.js";

function read(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) =>
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)[key]
      : undefined, source);
}

function numbers(actual: unknown, expected: unknown): [number, number] | undefined {
  if (typeof actual !== "number" || typeof expected !== "number" || !Number.isFinite(actual) || !Number.isFinite(expected)) return undefined;
  return [actual, expected];
}

export function matchesConditions(node: ConditionNode, context: Record<string, unknown>): boolean {
  if ("operator" in node) {
    return node.operator === "and"
      ? node.children.every((child) => matchesConditions(child, context))
      : node.children.some((child) => matchesConditions(child, context));
  }

  const actual = read(context, node.field);
  const expected = node.value;
  const operands = numbers(actual, expected);
  switch (node.comparator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "contains": return Array.isArray(actual)
      ? actual.includes(expected)
      : typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
    case "gt": return operands !== undefined && operands[0] > operands[1];
    case "gte": return operands !== undefined && operands[0] >= operands[1];
    case "lt": return operands !== undefined && operands[0] < operands[1];
    case "lte": return operands !== undefined && operands[0] <= operands[1];
    case "exists": return expected === false ? actual === undefined : actual !== undefined;
  }
}
