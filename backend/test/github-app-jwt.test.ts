import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createAppJwt } from "../src/modules/github-app/github-app.service.js";
import { env } from "../src/config/env.js";

describe("GitHub App JWT", () => {
  let originalId: string;
  let originalKey: string;
  let publicKey: string;

  beforeAll(() => {
    originalId = env.githubAppId;
    originalKey = env.githubAppPrivateKey;
    const { publicKey: pub, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    publicKey = pub;
    env.githubAppId = "123456";
    env.githubAppPrivateKey = privateKey;
  });

  afterAll(() => {
    env.githubAppId = originalId;
    env.githubAppPrivateKey = originalKey;
  });

  it("signs a valid RS256 JWT with correct issuer", () => {
    const token = createAppJwt();
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
    expect(decoded.iss).toBe("123456");
    expect(typeof decoded.iat).toBe("number");
    expect(typeof decoded.exp).toBe("number");
    expect(decoded.exp! - decoded.iat!).toBeGreaterThan(0);
  });

  it("throws when app id or private key is missing", () => {
    env.githubAppId = "";
    expect(() => createAppJwt()).toThrow();
    env.githubAppId = "123456";
  });
});
