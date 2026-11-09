import { Router } from "express";
import * as youtubeController from "../controllers/youtube.controller.js";

const router = Router();

router.get("/search", youtubeController.searchYoutubeReviews);

export default router;
