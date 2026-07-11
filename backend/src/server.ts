import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { env, validateEnv } from "./config/env.js";
import { database, closeDatabase } from "./core/database.js";
import { UserService } from "./modules/users/user.service.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { taskRouter } from "./modules/tasks/task.router.js";
import { webhookRouter } from "./modules/webhooks/webhook.router.js";
import { settingsRouter } from "./modules/settings/settings.router.js";
import { retryQueue } from "./modules/jobs/retry-queue.service.js";
import { notifyReview } from "./modules/notifications/notification.service.js";
validateEnv();
await database();
await new UserService().bootstrap(env.superadminEmail, env.superadminPassword);
const app = express();
const webhookRates = new Map<string, { count: number; reset: number }>();
app.use("/webhooks", (req, res, next) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const entry = webhookRates.get(key);
  const current =
    !entry || entry.reset < now ? { count: 0, reset: now + 60000 } : entry;
  current.count += 1;
  webhookRates.set(key, current);
  if (current.count > 120)
    return res.status(429).json({ error: "Too many requests" });
  next();
});
app.use("/webhooks", express.raw({ type: "application/json", limit: "2mb" }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", async (_req, res) => {
  try {
    await (await database()).command({ ping: 1 });
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/settings", settingsRouter);
app.use("/webhooks", webhookRouter);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../frontend/dist",
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  },
);
app.use(express.static(root));
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(root, "index.html")),
);
retryQueue.start(async (job) => {
  if (job.type === "notification")
    await notifyReview(
      job.payload.repository,
      job.payload.number,
      job.payload.url,
      job.payload.findings,
    );
});
const server = app.listen(env.port, () =>
  console.log(`Service on ${env.port}`),
);
process.on("SIGTERM", () => {
  retryQueue.stop();
  server.close(() => closeDatabase().then(() => process.exit(0)));
});
