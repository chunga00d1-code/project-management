import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifySignature } from "../src/modules/reviews/review.service.js";
import { env } from "../src/config/env.js";
describe("GitHub signature", () => {
  it("accepts a valid sha256 signature", () => {
    const body = Buffer.from('{"action":"opened"}');
    const original = env.githubWebhookSecret;
    env.githubWebhookSecret = "test-secret";
    const signature = `sha256=${crypto.createHmac("sha256", "test-secret").update(body).digest("hex")}`;
    expect(verifySignature(body, signature)).toBe(true);
    expect(verifySignature(body, "sha256=invalid")).toBe(false);
    env.githubWebhookSecret = original;
  });
});
