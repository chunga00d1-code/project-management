import { describe, it, expect, vi } from "vitest";
import { verifyOrigin } from "../src/core/csrf.js";

function mockReqRes(method: string, origin: string | undefined, host = "app.example.com") {
  const req: any = { method, header: (name: string) => (name.toLowerCase() === "origin" ? origin : name.toLowerCase() === "host" ? host : undefined) };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  return { req, res, next };
}

describe("verifyOrigin", () => {
  it("allows safe methods regardless of origin", () => {
    const middleware = verifyOrigin([]);
    const { req, res, next } = mockReqRes("GET", "https://evil.example.com");
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows requests with no origin header (native clients, curl)", () => {
    const middleware = verifyOrigin([]);
    const { req, res, next } = mockReqRes("POST", undefined);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows a same-origin POST request", () => {
    const middleware = verifyOrigin([]);
    const { req, res, next } = mockReqRes("POST", "https://app.example.com", "app.example.com");
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks a cross-origin POST request", () => {
    const middleware = verifyOrigin([]);
    const { req, res, next } = mockReqRes("POST", "https://evil.example.com", "app.example.com");
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows an explicitly whitelisted cross-origin", () => {
    const middleware = verifyOrigin(["https://trusted-partner.com"]);
    const { req, res, next } = mockReqRes("POST", "https://trusted-partner.com", "app.example.com");
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
