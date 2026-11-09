import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/favorites", userController.getFavorites);
router.post("/favorites/:productId", userController.addFavorite);
router.delete("/favorites/:productId", userController.removeFavorite);

export default router;
