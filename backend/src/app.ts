import express from "express";import cookieParser from "cookie-parser";import path from "path";import { fileURLToPath } from "url";import { env,validateEnv } from "./config/env.js";import { database } from "./core/database.js";import { rateLimiter } from "./core/rate-limit.js";import { UserService } from "./modules/users/user.service.js";import { authRouter } from "./modules/auth/auth.router.js";import { taskRouter } from "./modules/tasks/task.router.js";import { webhookRouter } from "./modules/webhooks/webhook.router.js";import { settingsRouter } from "./modules/settings/settings.router.js";import { verifyOrigin } from "./core/csrf.js";
export async function buildApp() {
  validateEnv();
  await database();
  await new UserService().bootstrap(env.superadminEmail, env.superadminPassword);
  const app = express();
  app.use("/webhooks", rateLimiter({ windowMs: 60000, max: 120, keyPrefix: "webhook" }));
  app.use("/webhooks", express.raw({ type: "application/json", limit: "2mb" }));
  app.use(express.json());
  app.use(cookieParser());
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", async (_req, res) => { try { await (await database()).command({ ping: 1 }); res.json({ status: "ready" }); } catch { res.status(503).json({ status: "not_ready" }); } });
  app.use("/api", verifyOrigin(env.allowedOrigins));
  app.use("/api/auth", authRouter);
  app.use("/api/tasks", taskRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/webhooks", webhookRouter);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
  app.use(express.static(root));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(root, "index.html")));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error); res.status(500).json({ error: "Internal server error" }); });
  return app;
}
