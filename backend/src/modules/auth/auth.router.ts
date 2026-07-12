import { Router } from "express"; import jwt from "jsonwebtoken"; import { randomUUID } from "crypto"; import { env } from "../../config/env.js"; import { authenticate, authorize, AuthRequest, Role } from "../../core/auth.js"; import { rateLimiter } from "../../core/rate-limit.js"; import { revokeToken } from "../../core/token-revocation.js"; import { logAudit } from "../../core/audit.js"; import { UserService } from "../users/user.service.js"; import { loginSchema, createUserSchema } from "./auth.schema.js";
const users = new UserService();
export const authRouter = Router();
const loginRateLimit = rateLimiter({ windowMs: 60_000, max: 10, keyPrefix: "login" });
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: env.nodeEnv === "production", maxAge: 8 * 60 * 60 * 1000 };

authRouter.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid email or password format" });
    const user = await users.login(parsed.data.email, parsed.data.password);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, jti: randomUUID() }, env.jwtSecret, { expiresIn: "8h" });
    res.cookie("token", token, cookieOptions);
    res.json({ user: { id: user._id, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) { try { const payload = jwt.verify(token, env.jwtSecret) as AuthRequest["user"]; if (payload?.jti && payload.exp) await revokeToken(payload.jti, new Date(payload.exp * 1000)); } catch { /* already invalid, nothing to revoke */ } }
    res.clearCookie("token", { httpOnly: true, sameSite: "lax", secure: env.nodeEnv === "production" });
    res.status(204).end();
  } catch (e) { next(e); }
});

authRouter.get("/me", authenticate, (req, res) => res.json((req as AuthRequest).user));

authRouter.get("/users", authenticate, authorize("superadmin", "admin"), async (_req, res, next) => {
  try { res.json(await users.list()); } catch (e) { next(e); }
});

authRouter.post("/users", authenticate, authorize("superadmin", "admin"), async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const requester = (req as AuthRequest).user!;
    if (parsed.data.role === "superadmin" && requester.role !== "superadmin") return res.status(403).json({ error: "Only a superadmin can create another superadmin" });
    const created = await users.create(parsed.data.email, parsed.data.password, parsed.data.role as Role);
    await logAudit(requester.email, "user.create", created._id, { email: created.email, role: created.role });
    res.status(201).json(created);
  } catch (e) { next(e); }
});
