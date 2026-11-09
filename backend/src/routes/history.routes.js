import { Router } from "express";
import * as historyController from "../controllers/history.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { logSearchSchema } from "../validators/history.validators.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, historyController.getMySearchHistory);
router.post("/", requireAuth, validate(logSearchSchema), historyController.logSearch);

export default router;
