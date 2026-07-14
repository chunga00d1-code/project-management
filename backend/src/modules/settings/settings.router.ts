import { Router } from "express";
import { authenticate, authorize, AuthRequest } from "../../core/auth.js";
import { audit } from "../../core/audit.service.js";
import { object, ValidationError } from "../../core/validation.js";
import { SettingsService, type RuntimeSettings } from "./settings.service.js";
const settings = new SettingsService();
const allowed = ["telegramToken", "telegramChatId", "smtpHost", "smtpPort", "smtpUser", "smtpPassword", "emailFrom", "blockingSeverities", "postReviewComment", "githubAssigneeMappings"];
function valid(input: unknown): RuntimeSettings { const body = object(input); if (Object.keys(body).some((key) => !allowed.includes(key))) throw new ValidationError("Unsupported settings field"); if (body.smtpPort !== undefined && (!Number.isInteger(body.smtpPort) || Number(body.smtpPort) < 1 || Number(body.smtpPort) > 65535)) throw new ValidationError("Invalid SMTP port"); if (body.blockingSeverities !== undefined && (!Array.isArray(body.blockingSeverities) || body.blockingSeverities.some((x) => !["critical", "high", "medium", "low"].includes(String(x))))) throw new ValidationError("Invalid blocking severity"); return body as RuntimeSettings; }
export const settingsRouter = Router();
settingsRouter.use(authenticate, authorize("superadmin", "admin"));
settingsRouter.get("/", async (_req, res, next) => { try { res.json(await settings.public()); } catch (e) { next(e); } });
settingsRouter.put("/", async (req, res, next) => { try { const value = await settings.update(valid(req.body)); await audit({ actor: (req as AuthRequest).user?.email, action: "settings.update", target: "runtime" }); res.json({ ...value, telegramToken: "", smtpPassword: "" }); } catch (e) { if (e instanceof ValidationError) return res.status(400).json({ error: e.message }); next(e); } });
