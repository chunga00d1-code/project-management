import { describe, it, expect } from "vitest";
import { hasPermission } from "../hooks/usePermission";

describe("hasPermission", () => {
  it("grants superadmin and admin access to settings, users and tasks", () => {
    for (const role of ["superadmin", "admin"]) {
      expect(hasPermission(role, "settings")).toBe(true);
      expect(hasPermission(role, "users")).toBe(true);
      expect(hasPermission(role, "tasks")).toBe(true);
    }
  });
  it("restricts manager and developer to tasks only", () => {
    for (const role of ["manager", "developer"]) {
      expect(hasPermission(role, "tasks")).toBe(true);
      expect(hasPermission(role, "settings")).toBe(false);
      expect(hasPermission(role, "users")).toBe(false);
    }
  });
  it("denies permissions for an unknown or missing role", () => {
    expect(hasPermission(undefined, "tasks")).toBe(false);
    expect(hasPermission("guest", "tasks")).toBe(false);
  });
});
