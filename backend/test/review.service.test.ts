import { describe, it, expect } from "vitest";
import crypto from "crypto";
process.env.GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "test-secret";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "admin@example.com";
process.env.SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "password123";
const { verifySignature } = await import("../src/modules/reviews/review.service.js");

describe("verifySignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = Buffer.from(JSON.stringify({ ok: true }));
    const signature = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(body).digest("hex");
    expect(verifySignature(body, signature)).toBe(true);
  });
  it("rejects a tampered payload", () => {
    const body = Buffer.from(JSON.stringify({ ok: true }));
    const signature = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(body).digest("hex");
    const tampered = Buffer.from(JSON.stringify({ ok: false }));
    expect(verifySignature(tampered, signature)).toBe(false);
  });
  it("rejects a missing or malformed header", () => {
    const body = Buffer.from("{}");
    expect(verifySignature(body, undefined)).toBe(false);
    expect(verifySignature(body, "not-a-signature")).toBe(false);
  });
});
