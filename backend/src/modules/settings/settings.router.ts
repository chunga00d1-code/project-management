import { Router } from "express";
import { authenticate, authorize } from "../../core/auth.js";
import { SettingsService } from "./settings.service.js";
const settings = new SettingsService();
export const settingsRouter = Router();
settingsRouter.use(authenticate);
settingsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await settings.public());
  } catch (e) {
    next(e);
  }
});
settingsRouter.put(
  "/",
  authorize("superadmin", "admin"),
  async (req, res, next) => {
    try {
      res.json(await settings.update(req.body));
    } catch (e) {
      next(e);
    }
  },
);
