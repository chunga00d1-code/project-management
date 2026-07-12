import type { RequestHandler } from "express";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export function verifyOrigin(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.header("origin");
    if (!origin) return next();
    const host = req.header("host");
    const sameOrigin = host && [`http://${host}`, `https://${host}`].includes(origin);
    if (sameOrigin || allowedOrigins.includes(origin)) return next();
    return res.status(403).json({ error: "Cross-origin request blocked" });
  };
}
