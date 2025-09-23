// server/routes/index.ts
import { Router } from "express";
import recipes from "./recipes";
import substitutions from "./substitutions";

const router = Router();

// group endpoints
router.use("/recipes", recipes);
router.use("/substitutions", substitutions);

export default router;
