import { describe, it, expect } from "vitest";
import { loginSchema, createUserSchema } from "../src/modules/auth/auth.schema.js";

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("createUserSchema", () => {
  it("accepts a valid user with an allowed role", () => {
    expect(createUserSchema.safeParse({ email: "a@b.com", password: "password123", role: "developer" }).success).toBe(true);
  });
  it("rejects a role outside the known enum", () => {
    expect(createUserSchema.safeParse({ email: "a@b.com", password: "password123", role: "root" }).success).toBe(false);
  });
  it("rejects a short password", () => {
    expect(createUserSchema.safeParse({ email: "a@b.com", password: "short", role: "developer" }).success).toBe(false);
  });
});
