import { Router } from "express";
import * as productController from "../controllers/product.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { compareProductsSchema } from "../validators/product.validators.js";

const router = Router();

router.get("/", productController.listProducts);
router.get("/categories", productController.getCategories);
router.post("/compare", validate(compareProductsSchema), productController.compareProducts);
router.get("/:id", productController.getProduct);
router.get("/:id/related", productController.getRelatedProducts);
router.get("/:id/prices", productController.getProductPrices);
router.get("/:id/history", productController.getProductPriceHistory);

export default router;
