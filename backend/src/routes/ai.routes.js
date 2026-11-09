import { Router } from "express";
import * as aiController from "../controllers/ai.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { analyzeRequirementSchema } from "../validators/ai.validators.js";

const router = Router();

router.post("/analyze-requirement", validate(analyzeRequirementSchema), aiController.analyzeRequirementHandler);

export default router;
