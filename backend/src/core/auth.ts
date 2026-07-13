import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { database } from "./database.js";
import type { UserModel } from "../modules/users/user.model.js";
export type Role = "superadmin" | "admin" | "manager" | "developer";
export interface AuthUser { id: string; email: string; role: Role; tokenVersion: number; }
export interface AuthRequest extends Express.Request { user?: AuthUser; }
export const authenticate: RequestHandler = async (req, res, next) => { try { const token = req.header("authorization")?.replace(/^Bearer\s+/i, ""); if (!token) return res.status(401).json({ error: "Authentication required" }); const payload = jwt.verify(token, env.jwtSecret, { issuer: "igen-pr-platform", audience: "igen-web" }) as AuthUser; const current = await (await database()).collection<UserModel>("users").findOne({ _id: payload.id }, { projection: { passwordHash: 0 } }); if (!current || current.active === false || (current.tokenVersion || 0) !== payload.tokenVersion || current.role !== payload.role || current.email !== payload.email) return res.status(401).json({ error: "Session revoked" }); (req as AuthRequest).user = payload; next(); } catch { return res.status(401).json({ error: "Invalid token" }); } };
export const authorize = (...roles: Role[]): RequestHandler => (req, res, next) => { const user = (req as AuthRequest).user; if (!user || !roles.includes(user.role)) return res.status(403).json({ error: "Insufficient role" }); next(); };
