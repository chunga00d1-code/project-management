import { randomUUID } from "crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import winston from "winston";
import { env } from "../config/env.js";
const redact = winston.format((info) => { for (const key of ["password", "passwordHash", "token", "authorization", "jwtSecret"]) if (key in info) info[key] = "[REDACTED]"; return info; });
const transports: winston.transport[] = [new winston.transports.Console()];
if (env.logFile) transports.push(new winston.transports.File({ filename: env.logFile, maxsize: env.logMaxSize, maxFiles: env.logMaxFiles }));
export const logger = winston.createLogger({ level: env.logLevel, defaultMeta: { service: "github-pr-webhook", environment: env.nodeEnv }, format: winston.format.combine(redact(), winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()), transports });
declare module "express-serve-static-core" { interface Request { requestId: string; } }
export const requestLogger: RequestHandler = (req, res, next) => { const incomingId = req.header("x-request-id"); req.requestId = incomingId && incomingId.length <= 128 ? incomingId : randomUUID(); res.setHeader("x-request-id", req.requestId); const startedAt = process.hrtime.bigint(); res.on("finish", () => { const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000; const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "http"; logger.log(level, "http_request", { requestId: req.requestId, method: req.method, path: req.originalUrl.split("?")[0], statusCode: res.statusCode, durationMs: Math.round(durationMs * 100) / 100, ip: req.ip, userAgent: req.header("user-agent") }); }); next(); };
export const errorLogger: ErrorRequestHandler = (error, req, res, _next) => { logger.error("unhandled_request_error", { requestId: req.requestId, method: req.method, path: req.originalUrl.split("?")[0], error }); res.status(500).json({ error: "Internal server error", requestId: req.requestId }); };

