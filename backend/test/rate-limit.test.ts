import { describe, it, expect, vi } from "vitest";
import { rateLimiter } from "../src/core/rate-limit.js";

function mockReqRes(ip: string) {
  const req: any = { ip };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  return { req, res, next };
}

describe("rateLimiter", () => {
  it("allows requests under the limit", () => {
    const middleware = rateLimiter({ windowMs: 60_000, max: 2, keyPrefix: "t1" });
    const a = mockReqRes("1.1.1.1");
    middleware(a.req, a.res, a.next);
    expect(a.next).toHaveBeenCalledOnce();
    expect(a.res.status).not.toHaveBeenCalled();
  });

  it("blocks requests once the limit is exceeded", () => {
    const middleware = rateLimiter({ windowMs: 60_000, max: 2, keyPrefix: "t2" });
    for (let i = 0; i < 2; i += 1) { const r = mockReqRes("2.2.2.2"); middleware(r.req, r.res, r.next); expect(r.next).toHaveBeenCalledOnce(); }
    const blocked = mockReqRes("2.2.2.2");
    middleware(blocked.req, blocked.res, blocked.next);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(429);
  });

  it("tracks separate ips independently", () => {
    const middleware = rateLimiter({ windowMs: 60_000, max: 1, keyPrefix: "t3" });
    const a = mockReqRes("3.3.3.3"); middleware(a.req, a.res, a.next); expect(a.next).toHaveBeenCalledOnce();
    const b = mockReqRes("4.4.4.4"); middleware(b.req, b.res, b.next); expect(b.next).toHaveBeenCalledOnce();
  });
});
