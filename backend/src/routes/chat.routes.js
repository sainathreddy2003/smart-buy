import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as chatController from "../controllers/chat.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { chatMessageSchema } from "../validators/recommendation.validators.js";

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "You're sending messages too quickly, slow down a bit." },
});

router.post("/", chatLimiter, validate(chatMessageSchema), chatController.chatWithAssistant);

export default router;
