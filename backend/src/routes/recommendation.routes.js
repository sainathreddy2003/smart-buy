import { Router } from "express";
import * as recommendationController from "../controllers/recommendation.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { createRecommendationSchema } from "../validators/recommendation.validators.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post(
  "/",
  optionalAuth,
  validate(createRecommendationSchema),
  recommendationController.createRecommendation
);
router.get("/history", requireAuth, recommendationController.getMyRecommendationHistory);
router.get("/:id", recommendationController.getRecommendation);

export default router;
